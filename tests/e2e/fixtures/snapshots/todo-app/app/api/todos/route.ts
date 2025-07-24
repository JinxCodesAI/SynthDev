import { NextRequest, NextResponse } from 'next/server'

interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

// In-memory store for todos
let todos: Todo[] = []

// GET /api/todos
export async function GET() {
  return NextResponse.json(todos)
}

// POST /api/todos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      )
    }

    const newTodo: Todo = {
      id: Date.now().toString(),
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    }

    todos.push(newTodo)
    return NextResponse.json(newTodo, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}