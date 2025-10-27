/**
 * Search Strategies Configuration
 * Defines all search strategies to test against the backend
 */

module.exports = {
  strategies: [
    // Production strategy - LIKE-based keyword splitting with AND logic
    {
      name: 'LIKE-Keyword-AND',
      description: 'LIKE search with keyword splitting (multi-word queries split into keywords with AND logic)',
      mode: 'like',
      excludeFields: ['description'],
      phraseMatch: false  // Split keywords, match production behavior
    },
    // Alternative - Phrase matching (for comparison)
    {
      name: 'LIKE-Phrase-Match',
      description: 'LIKE search with phrase matching (treats multi-word queries as complete phrases)',
      mode: 'like',
      excludeFields: ['description'],
      phraseMatch: true
    }
  ]
};
