const testOrigin = ['http://127.0.0.1:5174','http://localhost:5174'].includes(location.origin);
if (testOrigin) (await import('./pro-test-app.js')).mountTestPro();
else await import('./main.js');
