import app from './app';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
  console.log(`📚 API docs: http://localhost:${port}/api/v1/health`);
});
