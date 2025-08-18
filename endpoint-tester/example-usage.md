# Bulk Download Testing

## Test Scripts Created

1. **`test-endpoints.js`** - Enhanced general endpoint tester with file download support
2. **`test-bulk-download.js`** - Specific test for bulk download endpoint

## Usage Examples

### Test bulk download endpoint:

```bash
# Test with authentication (replace with real credentials)
node test-bulk-download.js your_username your_password

# The script will:
# - Login with provided credentials
# - Request bulk download for 3 Gradients5 datasets
# - Apply time/spatial/depth filters
# - Save the zip file to current directory
```

### General endpoint testing:

```bash
# Test other endpoints with file downloads
node test-endpoints.js POST /api/data/bulk-download username password

# Test with form data
node test-endpoints.js POST /api/data/bulk-download '{"shortNames":["dataset1"],"filters":{"temporal":{"startDate":"2023-01-01","endDate":"2023-01-02"},"spatial":{"latMin":0,"latMax":10,"lonMin":-10,"lonMax":10}}}' 
```

## Request Format

The bulk download endpoint expects:

```javascript
{
  shortNames: [
    "Gradients5_TN412_Hyperpro_Profiles",
    "Gradients5_TN412_FluorometricChlorophyll_UW", 
    "Gradients5_TN412_FluorometricChlorophyll_CTD"
  ],
  filters: {
    temporal: {
      startDate: "2023-01-26",
      endDate: "2023-01-31"
    },
    spatial: {
      latMin: 0,
      latMax: 30,
      lonMin: -140,
      lonMax: -120
    },
    depth: {
      min: 0,
      max: 20
    }
  }
}
```

## Features Added

- ✅ File download detection and saving
- ✅ Form data support for POST requests
- ✅ JWT authentication handling
- ✅ Progress tracking with file size
- ✅ Error handling for failed downloads

## Notes

- The endpoint requires authentication (401 without credentials)
- Downloads are saved to the current working directory
- File size and download path are displayed on success