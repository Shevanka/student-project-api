const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Student Portal API Server is running on port ${PORT}`);
  console.log(` API Base URL: http://localhost:${PORT}/api`);
  console.log(` Documentation: http://localhost:${PORT}/`);
  console.log(`====================================================`);
});
