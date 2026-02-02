import { config } from 'dotenv';
import { connect, model, Schema } from 'mongoose';

config();

const KnowledgeSchema = new Schema({}, { strict: false });
const KnowledgeDocument = model('KnowledgeDocument', KnowledgeSchema);

async function check() {
  const mongoUri = process.env.MONGO_URI;
  await connect(mongoUri);

  const allDocs = await KnowledgeDocument.find({}).lean();

  // Check for Spanish documents
  const spanishDocs = allDocs.filter((doc: any) =>
    doc.metadata?.language === 'es' || doc.metadata?.language === 'spanish'
  );

  console.log('Total documents:', allDocs.length);
  console.log('Spanish documents:', spanishDocs.length);

  // Check for "como creo una cuenta" specifically
  const accountDocs = allDocs.filter((doc: any) =>
    doc.title?.toLowerCase().includes('cuenta') ||
    doc.title?.toLowerCase().includes('creo') ||
    doc.title?.toLowerCase().includes('create') ||
    doc.title?.toLowerCase().includes('account')
  );

  console.log('\nDocuments about creating accounts:');
  accountDocs.forEach((doc: any) => {
    console.log(`- "${doc.title}" (lang: ${doc.metadata?.language}, region: ${doc.region})`);
  });

  // Show language distribution
  const langMap = {};
  allDocs.forEach((doc: any) => {
    const lang = doc.metadata?.language || 'unknown';
    langMap[lang] = (langMap[lang] || 0) + 1;
  });
  console.log('\nLanguage distribution:', langMap);

  process.exit(0);
}

check().catch(console.error);
