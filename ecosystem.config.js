module.exports = {
  apps: [

    {
      name: "backend",
      cwd: "/root/whatsapp-app/backend",
      script: "/root/whatsapp-app/backend/venv/bin/python",
      args: "-m uvicorn server:socket_app --host 127.0.0.1 --port 8001 --workers 1",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M"
    },

    {
      name: "whatsapp",
      cwd: "/root/whatsapp-app/whatsapp-service",
      script: "index.js",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M"
    }

  ]
};
