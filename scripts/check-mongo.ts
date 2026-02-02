import { config } from 'dotenv';
import { connect, model, Schema } from 'mongoose';

config();

const KnowledgeSchema = new Schema({}, { strict: false });
const KnowledgeDocument = model('KnowledgeDocument', KnowledgeSchema);

async function check() {
  const mongoUri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');

  await connect(mongoUri);

  // Check all documents
  const allDocs = await KnowledgeDocument.find({}).lean();
  console.log('\nTotal documents in knowledgedocuments collection:', allDocs.length);

  if (allDocs.length > 0) {
    console.log('\nDocuments with "Both" or "spain" region:');
    const relevantDocs = allDocs.filter((doc: any) =>
      doc.region === 'both' || doc.region === 'spain' || doc.region === 'Both'
    );
    console.log('Count:', relevantDocs.length);

    relevantDocs.slice(0, 5).forEach((doc: any, idx: number) => {
      console.log(`\n--- Document ${idx + 1} ---`);
      console.log('Title:', doc.title);
      console.log('Region:', doc.region);
      console.log('Language:', doc.metadata?.language);
      console.log('isActive:', doc.isActive);
      console.log('Has embedding:', doc.embedding?.length > 0);
    });
  }

  process.exit(0);
}

check().catch(console.error);
