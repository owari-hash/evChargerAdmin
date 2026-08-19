/**
 * PM2 process definition for the eplug.mn admin console.
 *
 *   npm run build && pm2 start ecosystem.config.cjs --env production
 *
 * Serves Next.js on 127.0.0.1:3001; nginx proxies https://eplug.mn/ to it.
 * Unlike the CSMS backend this process holds no per-connection state, so it can
 * safely be scaled (`instances: 2`) if the console ever needs it.
 */
module.exports = {
  apps: [
    {
      name: 'eplug-admin',
      // Call Next's binary directly: `npm start` would leave an extra shell in
      // the process tree that swallows PM2's stop signals.
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3001 -H 127.0.0.1',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: '768M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production', // makes Next load .env.production
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
      },
      out_file: './logs/admin.out.log',
      error_file: './logs/admin.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
