import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Listen on 0.0.0.0 so both 127.0.0.1 and localhost work (Windows can
  // resolve localhost to ::1 while Vite defaults to only one stack).
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
