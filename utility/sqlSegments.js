// SQL statement sections used in multiple routes

module.exports = {
  declareAndSetDateTimeVariables: `
        DECLARE @DateTimeVariable datetime
        SET @DateTimeVariable = GETDATE()
    `,

  dateTimeFromParts: `
        DATETIMEFROMPARTS ( 
            DATEPART(year, @DateTimeVariable), 
            DATEPART(month, @DateTimeVariable), 
            DATEPART(day, @DateTimeVariable), 
            DATEPART(hour, @DateTimeVariable), 
            0, 0, 0
        )
    `,
};
