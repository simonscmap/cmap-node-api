const dbx = require('../utility/DropboxVault');

const testDropboxConnectivity = async () => {
  console.log('🔗 Testing Dropbox connectivity...');
  
  try {
    // Test basic connectivity
    console.log('1️⃣ Testing basic API access...');
    const accountInfo = await dbx.usersGetCurrentAccount();
    console.log('✅ Connected to Dropbox account:', accountInfo.result.email);
    
    // Test folder listing to see if we can access vault
    console.log('2️⃣ Testing vault folder access...');
    const vaultContents = await dbx.filesListFolder({ path: '' });
    const folderNames = vaultContents.result.entries
      .filter(entry => entry['.tag'] === 'folder')
      .map(folder => folder.name);
    console.log('✅ Vault folders found:', folderNames);
    
    // Check if temp-downloads exists
    console.log('3️⃣ Checking temp-downloads folder...');
    const hasTempDownloads = folderNames.includes('temp-downloads');
    if (hasTempDownloads) {
      console.log('✅ temp-downloads folder exists');
    } else {
      console.log('⚠️  temp-downloads folder missing - this may cause the error');
      console.log('   Available folders:', folderNames);
    }
    
    return { connected: true, hasTempDownloads };
    
  } catch (error) {
    console.log('❌ Dropbox connectivity failed:', error.message);
    return { connected: false, error: error.message };
  }
};

if (require.main === module) {
  testDropboxConnectivity()
    .then(result => {
      console.log('');
      if (result.connected) {
        console.log('🎉 Dropbox connectivity verified!');
        if (!result.hasTempDownloads) {
          console.log('💡 Next step: Create /temp-downloads folder in Dropbox vault');
        }
      } else {
        console.log('💥 Fix Dropbox credentials first');
      }
    })
    .catch(console.error);
}

module.exports = { testDropboxConnectivity };