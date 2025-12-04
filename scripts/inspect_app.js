process.env.NODE_ENV = 'test';
const app = require('../server');
console.log('app type:', typeof app);
console.log('app keys:', Object.keys(app));
if (app && app._router) {
  console.log('router stack length:', app._router.stack.length);
} else {
  console.log('no _router on app');
}
process.exit(0);