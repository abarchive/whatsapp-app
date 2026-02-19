module.exports = {
  apps: [

    {
      name: "backend",
      script: "server.py",
      interpreter: "/root/whatsapp-app/backend/venv/bin/python",
      cwd: "/root/whatsapp-app/backend",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        PYTHONUNBUFFERED: "1"
      }
    },

    {
      name: "whatsapp",
      script: "index.js",
      cwd: "/root/whatsapp-app/whatsapp-service",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        PORT: 8002,
        HOST: "127.0.0.1",
        NODE_ENV: "production"
      }
    }

  ]
};

