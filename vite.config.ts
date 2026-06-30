import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // react-draggable (via react-rnd) reads process.env.DRAGGABLE_DEBUG at
    // runtime; the browser has no `process` global, so without this the
    // first drag throws "process is not defined" and aborts the drag.
    'process.env': '{}',
  },
})
