const generateQuery = require('./controllers/data/generateQueryFromConstraints');

describe('Monthly Climatology Query Generation', () => {
  const createMonthlyClimatologyMetadata = () => ({
    Temporal_Resolution: 'Monthly Climatology'
  });

  const createRegularMetadata = () => ({
    Temporal_Resolution: 'Daily'
  });

  describe('Non-monthly climatology data', () => {
    it('should use time constraints', () => {
      const tablename = 'test_table';
      const constraints = {
        time: { min: '2020-01-01', max: '2020-12-31' }
      };
      const metadata = createRegularMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain("time between '2020-01-01' and '2020-12-31'");
      expect(result).not.toContain('month');
    });
  });

  describe('Monthly climatology', () => {
    it('should handle start month < end month', () => {
      const tablename = 'climatology_table';
      const constraints = {
        time: { min: '2020-03-15', max: '2020-08-20' } // March to August
      };
      const metadata = createMonthlyClimatologyMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain('month between 3 and 8');
      expect(result).not.toContain('time between');
    });

    it('should swap when start month > end month', () => {
      const tablename = 'climatology_table';
      const constraints = {
        time: { min: '2020-10-15', max: '2020-05-20' } // October to May (should swap)
      };
      const metadata = createMonthlyClimatologyMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain('month between 5 and 10');
      expect(result).not.toContain('time between');
    });

    it('should handle start month = end month', () => {
      const tablename = 'climatology_table';
      const constraints = {
        time: { min: '2020-07-01', max: '2020-07-31' } // Same month (July)
      };
      const metadata = createMonthlyClimatologyMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain('month between 7 and 7');
      expect(result).not.toContain('time between');
    });

    it('should handle year boundary crossing (December to January)', () => {
      const tablename = 'climatology_table';
      const constraints = {
        time: { min: '2020-12-01', max: '2021-01-31' } // December to January
      };
      const metadata = createMonthlyClimatologyMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain('month between 1 and 12');
      expect(result).not.toContain('time between');
    });

    it('should handle additional spatial constraints', () => {
      const tablename = 'climatology_table';
      const constraints = {
        time: { min: '2020-01-15', max: '2020-06-20' },
        lat: { min: -10, max: 10 },
        lon: { min: -180, max: 180 }
      };
      const metadata = createMonthlyClimatologyMetadata();

      const result = generateQuery(tablename, constraints, metadata, 'data');

      expect(result).toContain('month between 1 and 6');
      expect(result).toContain('lat between -10 and 10');
      expect(result).toContain('lon between -180 and 180');
      expect(result).not.toContain('time between');
    });
  });
});