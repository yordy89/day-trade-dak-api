const mongoose = require('mongoose');
require('dotenv').config();

const ModulePermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moduleType: String,
  hasAccess: Boolean,
  isActive: Boolean,
  expiresAt: Date,
});

const UserSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
});

const ModulePermission = mongoose.model('ModulePermission', ModulePermissionSchema);
const User = mongoose.model('User', UserSchema);

async function findPermissionUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    // Find all liveWeekly permissions
    const permissions = await ModulePermission.find({
      moduleType: 'liveWeekly',
      isActive: true,
      hasAccess: true,
    });

    console.log(`\n=== Found ${permissions.length} liveWeekly permissions ===`);
    
    for (const perm of permissions) {
      console.log(`\nPermission ID: ${perm._id}`);
      console.log(`User ID in permission: ${perm.userId}`);
      
      // Find the user
      const user = await User.findById(perm.userId);
      if (user) {
        console.log(`User found: ${user.email} (${user.firstName} ${user.lastName})`);
      } else {
        console.log(`User not found for ID: ${perm.userId}`);
        
        // Try to find user by email
        const userByEmail = await User.findOne({ email: 'yordyat1107@gmail.com' });
        if (userByEmail) {
          console.log(`\nCorrect user ID should be: ${userByEmail._id}`);
          console.log(`Current permission has wrong user ID: ${perm.userId}`);
        }
      }
    }

    // Check all users with this email
    const allUsers = await User.find({ email: 'yordyat1107@gmail.com' });
    console.log(`\n=== All users with email yordyat1107@gmail.com ===`);
    allUsers.forEach(u => {
      console.log(`ID: ${u._id}, Name: ${u.firstName} ${u.lastName}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findPermissionUser();