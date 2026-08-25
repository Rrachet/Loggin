$env:DEMO_PASSWORD = if ($env:DEMO_PASSWORD) { $env:DEMO_PASSWORD } else { 'LogginDemo123!' }
npm run seed:demo
