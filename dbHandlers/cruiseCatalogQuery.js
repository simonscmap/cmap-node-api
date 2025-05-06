module.exports = `
    SELECT
    Name,
    Nickname as Variable,
    Name as Long_Name,
    'Observation' as Make,
    'Cruise Trajectories' as Dataset_Name,
    Ship_Name,
    Chief_Name,
    Start_Time as Time_Min,
    End_Time as Time_Max,
    Lat_Min,
    Lat_Max,
    Lon_Min,
    Lon_Max,
    null AS Depth_Min,
    null AS Depth_Max,
    'Cruise' as Product_Type 
    FROM [dbo].[tblCruise]    
    LEFT OUTER JOIN (
        SELECT
        cruise_ID,
        STRING_AGG(CAST(keywords AS nvarchar(MAX)), ',') as Keywords
        FROM tblCruise_Keywords
        GROUP BY cruise_ID
    ) AS aggs
    ON aggs.cruise_ID = tblCruise.ID
`;

// CONCAT('Trajectory_', Name) as Dataset_Name,
