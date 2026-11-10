import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-4">
          EventTick Frontend
        </h1>
        <p className="text-slate-400 mb-6 text-sm">
          Vite + React + Tailwind CSS
        </p>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-medium transition duration-200 shadow-lg shadow-blue-500/25 cursor-pointer"
          >
            Count is {count}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Edit <code className="text-cyan-400 font-mono bg-slate-950/60 px-1.5 py-0.5 rounded">src/App.jsx</code> to get started.
        </p>
      </div>
    </div>
  )
}
