const mongoose = require('mongoose');
require('dotenv').config();

const ModulePermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moduleType: String,
  hasAccess: Boolean,
  isActive: Boolean,
  expiresAt: Date,
});

const ModulePermission = mongoose.model('ModulePermission', ModulePermissionSchema);

async function verifyPermissions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    const userId = '68a3755a3911d9424693031a';
    
    // Find permissions for this specific user ID
    const permissions = await ModulePermission.find({
      userId: userId,
      isActive: true,
      hasAccess: true,
    });

    console.log(`\n=== Permissions for User ID ${userId} ===`);
    console.log(`Found ${permissions.length} active permissions`);
    
    permissions.forEach(perm => {
      console.log(`\nModule Type: ${perm.moduleType}`);
      console.log(`  Has Access: ${perm.hasAccess}`);
      console.log(`  Is Active: ${perm.isActive}`);
      console.log(`  Expires At: ${perm.expiresAt || 'Never'}`);
    });

    // Check specifically for liveWeekly
    const liveWeeklyPerm = await ModulePermission.findOne({
      userId: userId,
      moduleType: 'liveWeekly',
      isActive: true,
      hasAccess: true,
    });

    console.log(`\n=== Live Weekly Permission Check ===`);
    console.log(`Has liveWeekly permission: ${!!liveWeeklyPerm}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPermissions();