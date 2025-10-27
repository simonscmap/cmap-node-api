/**
 * Test Queries Configuration
 * Defines test queries covering various search scenarios
 */

module.exports = {
  queries: [
    // ===== Text-only searches =====
    {
      name: 'Simple keyword: CTD',
      text: 'CTD',
      filters: {}
    },
    {
      name: 'Simple keyword: carbon',
      text: 'carbon',
      filters: {}
    },
    {
      name: 'Simple keyword: temperature',
      text: 'temperature',
      filters: {}
    },
    {
      name: 'Multi-word: sea surface temperature',
      text: 'sea surface temperature',
      filters: {}
    },
    {
      name: 'Multi-word: ocean color',
      text: 'ocean color',
      filters: {}
    },
    {
      name: 'Specific measurement: chlorophyll',
      text: 'chlorophyll',
      filters: {}
    },
    {
      name: 'Instrument name: ARGO',
      text: 'ARGO',
      filters: {}
    },
    {
      name: 'Region name: Atlantic',
      text: 'Atlantic',
      filters: {}
    },

    // ===== Spatial filters only =====
    {
      name: 'Spatial only: equatorial band',
      text: '',
      filters: {
        latMin: -10,
        latMax: 10,
        lonMin: -180,
        lonMax: 180
      }
    },
    {
      name: 'Spatial only: North Pacific',
      text: '',
      filters: {
        latMin: 20,
        latMax: 60,
        lonMin: 140,
        lonMax: -120
      }
    },
    {
      name: 'Spatial only: Southern Ocean',
      text: '',
      filters: {
        latMin: -70,
        latMax: -40,
        lonMin: -180,
        lonMax: 180
      }
    },

    // ===== Text + Spatial filters =====
    {
      name: 'Text + Spatial: carbon in Pacific',
      text: 'carbon',
      filters: {
        latMin: -60,
        latMax: 60,
        lonMin: 120,
        lonMax: -70
      }
    },
    {
      name: 'Text + Spatial: CTD in Atlantic',
      text: 'CTD',
      filters: {
        latMin: -60,
        latMax: 60,
        lonMin: -80,
        lonMax: 20
      }
    },

    // ===== Temporal filters only =====
    {
      name: 'Temporal only: recent (2020-2023)',
      text: '',
      filters: {
        timeStart: '2020-01-01',
        timeEnd: '2023-12-31'
      }
    },
    {
      name: 'Temporal only: historical (2000-2010)',
      text: '',
      filters: {
        timeStart: '2000-01-01',
        timeEnd: '2010-12-31'
      }
    },

    // ===== Text + Temporal filters =====
    {
      name: 'Text + Temporal: temperature 2015-2020',
      text: 'temperature',
      filters: {
        timeStart: '2015-01-01',
        timeEnd: '2020-12-31'
      }
    },
    {
      name: 'Text + Temporal: salinity recent',
      text: 'salinity',
      filters: {
        timeStart: '2018-01-01',
        timeEnd: '2023-12-31'
      }
    },

    // ===== Depth filters only =====
    {
      name: 'Has depth data only',
      text: '',
      filters: {
        hasDepth: true
      }
    },
    {
      name: 'Depth range: surface (0-100m)',
      text: '',
      filters: {
        depthMin: 0,
        depthMax: 100
      }
    },
    {
      name: 'Depth range: deep ocean (1000-5000m)',
      text: '',
      filters: {
        depthMin: 1000,
        depthMax: 5000
      }
    },

    // ===== Text + Depth filters =====
    {
      name: 'Text + Depth: oxygen with depth',
      text: 'oxygen',
      filters: {
        hasDepth: true
      }
    },

    // ===== Combined filters (all types) =====
    {
      name: 'Complex: CTD + spatial + temporal + depth',
      text: 'CTD',
      filters: {
        latMin: -40,
        latMax: 40,
        lonMin: -180,
        lonMax: 180,
        timeStart: '2010-01-01',
        timeEnd: '2023-12-31',
        hasDepth: true
      }
    },
    {
      name: 'Complex: salinity + Pacific + recent + shallow',
      text: 'salinity',
      filters: {
        latMin: -60,
        latMax: 60,
        lonMin: 120,
        lonMax: -70,
        timeStart: '2018-01-01',
        timeEnd: '2023-12-31',
        depthMin: 0,
        depthMax: 200
      }
    },

    // ===== Edge cases =====
    {
      name: 'Empty search (no text, no filters)',
      text: '',
      filters: {}
    },
    {
      name: 'Single letter search: A',
      text: 'A',
      filters: {}
    },
    {
      name: 'Special characters: O2',
      text: 'O2',
      filters: {}
    },
    {
      name: 'Hyphenated term: sea-ice',
      text: 'sea-ice',
      filters: {}
    },
    {
      name: 'Underscore term: sea_surface',
      text: 'sea_surface',
      filters: {}
    },
    {
      name: 'Number in search: CO2',
      text: 'CO2',
      filters: {}
    },

    // ===== Common scientific terms =====
    {
      name: 'Scientific term: phytoplankton',
      text: 'phytoplankton',
      filters: {}
    },
    {
      name: 'Scientific term: nutrients',
      text: 'nutrients',
      filters: {}
    },
    {
      name: 'Scientific term: biogeochemical',
      text: 'biogeochemical',
      filters: {}
    },

    // ===== Additional diverse keyword tests =====
    // 1-word queries
    {
      name: '1-word: salinity',
      text: 'salinity',
      filters: {}
    },
    {
      name: '1-word: nitrate',
      text: 'nitrate',
      filters: {}
    },
    {
      name: '1-word: satellite',
      text: 'satellite',
      filters: {}
    },
    {
      name: '1-word: zooplankton',
      text: 'zooplankton',
      filters: {}
    },

    // 2-word queries
    {
      name: '2-word: dissolved oxygen',
      text: 'dissolved oxygen',
      filters: {}
    },
    {
      name: '2-word: primary production',
      text: 'primary production',
      filters: {}
    },
    {
      name: '2-word: wind speed',
      text: 'wind speed',
      filters: {}
    },
    {
      name: '2-word: mixed layer',
      text: 'mixed layer',
      filters: {}
    },

    // 3-word queries
    {
      name: '3-word: particulate organic carbon',
      text: 'particulate organic carbon',
      filters: {}
    },
    {
      name: '3-word: sea level anomaly',
      text: 'sea level anomaly',
      filters: {}
    },
    {
      name: '3-word: net primary productivity',
      text: 'net primary productivity',
      filters: {}
    },

    // 4-word queries
    {
      name: '4-word: photosynthetically available radiation par',
      text: 'photosynthetically available radiation par',
      filters: {}
    },
    {
      name: '4-word: colored dissolved organic matter',
      text: 'colored dissolved organic matter',
      filters: {}
    },

    // 5-word queries
    {
      name: '5-word: sea surface height above geoid',
      text: 'sea surface height above geoid',
      filters: {}
    },
    {
      name: '5-word: particulate inorganic carbon concentration pic',
      text: 'particulate inorganic carbon concentration pic',
      filters: {}
    }
  ]
};
