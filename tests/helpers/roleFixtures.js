import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Role fixture manager for tests
 * Provides controlled, predictable role configurations for different test scenarios
 */
export class RoleFixtures {
    constructor() {
        this.fixturesDir = join(__dirname, '..', 'e2e', 'fixtures');
        this.activeFixtures = new Set();
    }

    /**
     * Available role fixture configurations
     */
    static get FIXTURES() {
        return {
            ROLE_GROUPS: 'role-groups.json',
            SIMPLE_ROLES: 'roles.json',
        };
    }

    /**
     * Load a role fixture configuration
     * @param {string} fixtureName - Name of the fixture file
     * @returns {Object} Role configuration object
     */
    loadFixture(fixtureName) {
        const fixturePath = join(this.fixturesDir, fixtureName);

        try {
            const content = readFileSync(fixturePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load role fixture ${fixtureName}: ${error.message}`);
        }
    }

    /**
     * Create a mock SystemMessages class that uses fixture data
     * @param {string} fixtureName - Name of the fixture to use
     * @returns {Object} Mock SystemMessages class
     */
    createMockSystemMessages(fixtureName) {
        const fixture = this.loadFixture(fixtureName);

        // Handle both grouped and flat role structures
        let roles, roleGroups;
        if (fixture.groups) {
            // Grouped structure
            roleGroups = fixture.groups;
            roles = {};

            // Flatten roles for backward compatibility
            // First, detect ambiguous roles (same name in multiple non-global groups)
            const roleGroupMap = {}; // roleName -> [groupNames]

            for (const [groupName, groupRoles] of Object.entries(fixture.groups)) {
                for (const roleName of Object.keys(groupRoles)) {
                    if (!roleGroupMap[roleName]) {
                        roleGroupMap[roleName] = [];
                    }
                    roleGroupMap[roleName].push(groupName);
                }
            }

            // Process global group first to give it priority
            const groupOrder = [
                'global',
                ...Object.keys(fixture.groups).filter(g => g !== 'global'),
            ];

            for (const groupName of groupOrder) {
                const groupRoles = fixture.groups[groupName];
                if (!groupRoles) {
                    continue;
                }

                for (const [roleName, roleConfig] of Object.entries(groupRoles)) {
                    // Check if this role is ambiguous (exists in multiple non-global groups)
                    const groupsWithRole = roleGroupMap[roleName] || [];
                    const nonGlobalGroups = groupsWithRole.filter(g => g !== 'global');
                    const isAmbiguous = nonGlobalGroups.length > 1 && groupName !== 'global';

                    // Only add if not already present (global takes priority)
                    // Skip ambiguous roles unless they're in global group
                    if (!roles[roleName] && (!isAmbiguous || groupName === 'global')) {
                        roles[roleName] = {
                            ...roleConfig,
                            _group: groupName,
                            _source: `${groupName}.json`,
                            _ambiguous: isAmbiguous && groupName !== 'global',
                            _availableGroups: isAmbiguous ? nonGlobalGroups : undefined,
                        };
                    }
                }
            }
        } else {
            // Flat structure - assign all to global group
            roles = fixture;
            roleGroups = { global: fixture };

            // Add group metadata
            for (const [roleName, roleConfig] of Object.entries(roles)) {
                roleConfig._group = 'global';
                roleConfig._source = 'roles.json';
            }
        }

        // Create mock SystemMessages class
        const MockSystemMessages = {
            // Instance properties
            roles,
            _roleGroups: roleGroups,

            // Static methods
            hasRole: vi.fn(roleName => {
                return roles.hasOwnProperty(roleName);
            }),

            getLevel: vi.fn(roleName => {
                return roles[roleName]?.level || 'base';
            }),

            getEnabledAgents: vi.fn(roleSpec => {
                // Handle group-prefixed role specifications
                if (roleSpec.includes('.')) {
                    const [group, roleName] = roleSpec.split('.', 2);

                    // Check if role exists in the specified group
                    if (roleGroups[group] && roleGroups[group][roleName]) {
                        const role = roleGroups[group][roleName];
                        return role.enabled_agents || [];
                    }

                    return [];
                } else {
                    // Handle regular role name
                    return roles[roleSpec]?.enabled_agents || [];
                }
            }),

            canSpawnAgent: vi.fn((supervisorRole, workerRole) => {
                const enabledAgents = MockSystemMessages.getEnabledAgents(supervisorRole);

                // Check direct match first
                if (enabledAgents.includes(workerRole)) {
                    return true;
                }

                // Resolve the worker role to get its actual name and group
                const workerResolution = MockSystemMessages.resolveRole(workerRole);
                if (!workerResolution.found || workerResolution.ambiguous) {
                    return false;
                }

                // Check if any enabled agent matches the worker role
                for (const enabledAgent of enabledAgents) {
                    if (enabledAgent === workerRole) {
                        continue;
                    }

                    const enabledResolution = MockSystemMessages.resolveRole(enabledAgent);
                    if (!enabledResolution.found || enabledResolution.ambiguous) {
                        continue;
                    }

                    // Check if the role names match (regardless of group specification)
                    if (enabledResolution.roleName === workerResolution.roleName) {
                        return true;
                    }
                }

                return false;
            }),

            isAgentic: vi.fn(roleName => {
                const role = roles[roleName];
                return role && (role.enabled_agents || role.can_create_tasks_for);
            }),

            getRolesByGroup: vi.fn(groupName => {
                if (!roleGroups[groupName]) {
                    return [];
                }
                return Object.keys(roleGroups[groupName]);
            }),

            getRoleGroup: vi.fn(roleName => {
                const role = roles[roleName];
                return role?._group || 'global';
            }),

            resolveRole: vi.fn(roleSpec => {
                // Check if roleSpec contains a group prefix
                if (roleSpec.includes('.')) {
                    const [group, roleName] = roleSpec.split('.', 2);

                    // Check if role exists in the specified group
                    const rolesInGroup = MockSystemMessages.getRolesByGroup(group);
                    if (rolesInGroup.includes(roleName)) {
                        return { roleName, group, found: true, ambiguous: false };
                    }

                    return { roleName, group, found: false, ambiguous: false };
                } else {
                    // No group specified, look in global first, then check for ambiguity
                    const globalRoles = MockSystemMessages.getRolesByGroup('global');
                    if (globalRoles.includes(roleSpec)) {
                        return {
                            roleName: roleSpec,
                            group: 'global',
                            found: true,
                            ambiguous: false,
                        };
                    }

                    // Check for ambiguity: same role in multiple non-global groups
                    const allGroups = Object.keys(roleGroups || {});
                    const groupsWithRole = allGroups.filter(g => {
                        if (g === 'global') {
                            return false; // Skip global as it's already checked
                        }
                        const rolesInGroup = MockSystemMessages.getRolesByGroup(g);
                        return rolesInGroup.includes(roleSpec);
                    });

                    if (groupsWithRole.length > 1) {
                        // Ambiguous: role exists in multiple non-global groups
                        return {
                            roleName: roleSpec,
                            group: null,
                            found: false,
                            ambiguous: true,
                            availableGroups: groupsWithRole,
                        };
                    }

                    // Check if role exists in any single non-global group
                    if (groupsWithRole.length === 1) {
                        return {
                            roleName: roleSpec,
                            group: groupsWithRole[0],
                            found: true,
                            ambiguous: false,
                        };
                    }

                    // Role not found anywhere
                    return {
                        roleName: roleSpec,
                        group: 'global',
                        found: false,
                        ambiguous: false,
                    };
                }
            }),

            resolveRoleArray: vi.fn(roleSpecs => {
                const resolved = [];
                const errors = [];

                for (const roleSpec of roleSpecs) {
                    const resolution = MockSystemMessages.resolveRole(roleSpec);

                    if (resolution.ambiguous) {
                        errors.push(
                            `Role '${roleSpec}' is ambiguous. Found in groups: ${resolution.availableGroups.join(', ')}. ` +
                                `Please specify group explicitly (e.g., '${resolution.availableGroups[0]}.${roleSpec}')`
                        );
                    } else if (!resolution.found) {
                        errors.push(`Role '${roleSpec}' not found`);
                    } else {
                        // Use the original roleSpec if it was group-prefixed, otherwise use just the role name
                        resolved.push(roleSpec.includes('.') ? roleSpec : resolution.roleName);
                    }
                }

                return { resolved, errors };
            }),

            getSystemMessage: vi.fn(roleSpec => {
                // Handle group-prefixed role specifications
                if (roleSpec.includes('.')) {
                    const [group, roleName] = roleSpec.split('.', 2);

                    // Check if role exists in the specified group
                    if (roleGroups[group] && roleGroups[group][roleName]) {
                        const role = roleGroups[group][roleName];
                        return role.systemMessage || 'Default system message';
                    }

                    throw new Error(`Unknown role: ${roleSpec}`);
                } else {
                    // Handle regular role name
                    const role = roles[roleSpec];
                    if (!role) {
                        throw new Error(`Unknown role: ${roleSpec}`);
                    }
                    return role.systemMessage || 'Default system message';
                }
            }),
        };

        return MockSystemMessages;
    }

    /**
     * Create a mock SystemMessages instance for testing
     * @param {string} fixtureName - Name of the fixture to use
     * @returns {Function} Cleanup function to restore original SystemMessages
     */
    mockSystemMessages(fixtureName) {
        const mockSystemMessages = this.createMockSystemMessages(fixtureName);

        // Store original SystemMessages methods if they exist
        const originalMethods = {};

        // Mock the SystemMessages class methods
        vi.doMock('../../../src/core/ai/systemMessages.js', () => ({
            default: mockSystemMessages,
        }));

        this.activeFixtures.add(fixtureName);

        // Return cleanup function
        return () => {
            this.activeFixtures.delete(fixtureName);
            vi.doUnmock('../../../src/core/ai/systemMessages.js');
        };
    }

    /**
     * Clean up all active fixtures
     */
    restoreAll() {
        for (const fixtureName of this.activeFixtures) {
            vi.doUnmock('../../../src/core/ai/systemMessages.js');
        }
        this.activeFixtures.clear();
    }
}

/**
 * Convenience function to create a role fixture manager
 * @returns {RoleFixtures} New role fixture manager instance
 */
export function createRoleFixtures() {
    return new RoleFixtures();
}

/**
 * Convenience function to create a mock SystemMessages with role fixtures
 * @param {string} fixtureName - Name of the fixture to use
 * @returns {Object} Mock SystemMessages instance
 */
export function createMockSystemMessages(fixtureName = RoleFixtures.FIXTURES.ROLE_GROUPS) {
    const fixtures = new RoleFixtures();
    return fixtures.createMockSystemMessages(fixtureName);
}
