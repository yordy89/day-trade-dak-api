export default () => ({
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/default',
});
