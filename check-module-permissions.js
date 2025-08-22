const mongoose = require('mongoose');
require('dotenv').config();

// Define User schema first
const UserSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
});

const User = mongoose.model('User', UserSchema);

const ModulePermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moduleType: String,
  hasAccess: Boolean,
  isActive: Boolean,
  expiresAt: Date,
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const ModulePermission = mongoose.model('ModulePermission', ModulePermissionSchema);

async function checkPermissions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    // Find all module permissions
    const permissions = await ModulePermission.find({
      isActive: true,
      hasAccess: true,
    }).populate('userId', 'email firstName lastName');

    console.log('\n=== Active Module Permissions ===');
    permissions.forEach(perm => {
      const user = perm.userId;
      console.log(`\nUser: ${user?.email || 'Unknown'} (${user?.firstName} ${user?.lastName})`);
      console.log(`  Module Type: ${perm.moduleType}`);
      console.log(`  Has Access: ${perm.hasAccess}`);
      console.log(`  Is Active: ${perm.isActive}`);
      console.log(`  Expires At: ${perm.expiresAt || 'Never'}`);
    });

    // Check specifically for liveWeekly permissions
    const liveWeeklyPerms = await ModulePermission.find({
      moduleType: { $in: ['liveWeekly', 'LiveWeekly', 'LIVE_WEEKLY', 'live_weekly'] },
      isActive: true,
      hasAccess: true,
    }).populate('userId', 'email');

    console.log('\n=== Live Weekly Permissions (all variations) ===');
    console.log(`Found ${liveWeeklyPerms.length} permissions`);
    liveWeeklyPerms.forEach(perm => {
      console.log(`  User: ${perm.userId?.email}, Module: ${perm.moduleType}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPermissions();