const mongoose = require('mongoose');
require('dotenv').config();

async function debugPermissionType() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('modulepermissions');
    
    // Find all liveWeekly permissions
    const permissions = await collection.find({
      moduleType: 'liveWeekly',
      isActive: true,
      hasAccess: true,
    }).toArray();

    console.log(`\n=== Found ${permissions.length} liveWeekly permissions ===`);
    
    permissions.forEach(perm => {
      console.log(`\nPermission ID: ${perm._id}`);
      console.log(`User ID: ${perm.userId}`);
      console.log(`User ID type: ${typeof perm.userId}`);
      console.log(`Is ObjectId: ${perm.userId instanceof mongoose.Types.ObjectId}`);
      
      // Try both string and ObjectId comparison
      const targetUserId = '68a3755a3911d9424693031a';
      const targetObjectId = new mongoose.Types.ObjectId(targetUserId);
      
      console.log(`String comparison: ${perm.userId.toString() === targetUserId}`);
      console.log(`ObjectId comparison: ${perm.userId.equals ? perm.userId.equals(targetObjectId) : false}`);
    });

    // Now try to query with both string and ObjectId
    const userId = '68a3755a3911d9424693031a';
    const objectId = new mongoose.Types.ObjectId(userId);
    
    const perm1 = await collection.findOne({
      userId: userId,
      moduleType: 'liveWeekly',
      isActive: true,
      hasAccess: true,
    });
    
    const perm2 = await collection.findOne({
      userId: objectId,
      moduleType: 'liveWeekly',
      isActive: true,
      hasAccess: true,
    });
    
    console.log(`\n=== Query Results ===`);
    console.log(`Query with string: ${!!perm1}`);
    console.log(`Query with ObjectId: ${!!perm2}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugPermissionType();