const { Application } = require('../dist/index.js');

let app;

module.exports = async (req, res) => {
  if (!app) {
    const application = new Application();
    await application.start();
    app = application.getApp();
  }
  
  return app(req, res);
};