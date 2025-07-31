const generateTestFiles = (fileCount) => {
  const files = [];
  for (let i = 1; i <= fileCount; i++) {
    files.push({
      filePath: `/vault/observation/in-situ/cruise/tblPARAGON1_KM2112_Leu_InSitu/rep/${String(i).padStart(3, '0')}.txt`,
      name: `${String(i).padStart(3, '0')}.txt`
    });
  }
  return files;
};

const generateTestPayload = (fileCount = 50) => {
  return {
    shortName: "PARAGON1_KM2112_Leu_InSitu",
    datasetId: 771,
    files: generateTestFiles(fileCount)
  };
};

module.exports = {
  generateTestFiles,
  generateTestPayload
};