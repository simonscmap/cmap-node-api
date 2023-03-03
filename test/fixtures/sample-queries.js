// Export pairs of sample queries and the expected set of tables visited by the query
const { COMMAND_TYPES } = require("../../utility/constants");
const { sproc, custom } = COMMAND_TYPES;

const q1 = "select SubTrophic_Level as [title] from tblOrgSubTrophics";

const q2 =
  "SELECT t1.*, CMAP_sst_tblSST_AVHRR_OI_NRT, CMAP_chl_tblCHL_REP, CMAP_POC_tblModis_POC, CMAP_AOD_tblModis_AOD_REP, CMAP_sss_tblSSS_NRT, CMAP_wind_speed_tblWind_NRT, CMAP_wind_stress_tblWind_NRT, CMAP_wind_stress_curl_tblWind_NRT, CMAP_PAR_tblModis_PAR, CMAP_sla_tblAltimetry_REP, CMAP_adt_tblAltimetry_REP, CMAP_ugos_tblAltimetry_REP, CMAP_vgos_tblAltimetry_REP, CMAP_ugosa_tblAltimetry_REP, CMAP_vgosa_tblAltimetry_REP, CMAP_NO3_tblPisces_NRT, CMAP_PO4_tblPisces_NRT, CMAP_Fe_tblPisces_NRT, CMAP_O2_tblPisces_NRT, CMAP_Si_tblPisces_NRT, CMAP_PP_tblPisces_NRT, CMAP_CHL_tblPisces_NRT, CMAP_PHYC_tblPisces_NRT, CMAP_phytoplankton_diversity_shannon_index_tblDarwin_Ecosystem, CMAP_primary_production_tblDarwin_Ecosystem, CMAP_CHL_tblDarwin_Ecosystem, CMAP_phytoplankton_tblDarwin_Ecosystem, CMAP_zooplankton_tblDarwin_Ecosystem, CMAP_DIN_tblDarwin_Nutrient, CMAP_FeT_tblDarwin_Nutrient, CMAP_O2_tblDarwin_Nutrient, CMAP_PO4_tblDarwin_Nutrient, CMAP_SiO2_tblDarwin_Nutrient, CMAP_irradiance_reflectance_waveband_3_tblDarwin_Ocean_Color, CMAP_irradiance_reflectance_waveband_7_tblDarwin_Ocean_Color, CMAP_diatom_tblDarwin_Phytoplankton, CMAP_coccolithophore_tblDarwin_Phytoplankton, CMAP_mixotrophic_dinoflagellate_tblDarwin_Phytoplankton, CMAP_picoeukaryote_tblDarwin_Phytoplankton, CMAP_picoprokaryote_tblDarwin_Phytoplankton, CMAP_sea_water_temp_WOA_clim_tblWOA_Climatology, CMAP_density_WOA_clim_tblWOA_Climatology, CMAP_salinity_WOA_clim_tblWOA_Climatology, CMAP_nitrate_WOA_clim_tblWOA_Climatology, CMAP_phosphate_WOA_clim_tblWOA_Climatology, CMAP_silicate_WOA_clim_tblWOA_Climatology, CMAP_oxygen_WOA_clim_tblWOA_Climatology, CMAP_AOU_WOA_clim_tblWOA_Climatology, CMAP_o2sat_WOA_clim_tblWOA_Climatology, CMAP_conductivity_WOA_clim_tblWOA_Climatology, CMAP_prokaryote_c01_darwin_clim_tblDarwin_Plankton_Climatology, CMAP_prokaryote_c02_darwin_clim_tblDarwin_Plankton_Climatology, CMAP_picoeukaryote_c03_darwin_clim_tblDarwin_Plankton_Climatology, CMAP_picoeukaryote_c04_darwin_clim_tblDarwin_Plankton_Climatology, CMAP_DIC_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_DOC_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_DOFe_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_DON_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_DOP_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_FeT_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_NH4_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_NO2_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_NO3_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_O2_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_PIC_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_PO4_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_POC_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_POFe_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_PON_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_POSi_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_SiO2_darwin_clim_tblDarwin_Nutrient_Climatology, CMAP_mls_da_argo_clim_tblArgo_MLD_Climatology, CMAP_mls_dt_argo_clim_tblArgo_MLD_Climatology, CMAP_mlt_da_argo_clim_tblArgo_MLD_Climatology, CMAP_mlt_dt_argo_clim_tblArgo_MLD_Climatology, CMAP_mlpd_da_argo_clim_tblArgo_MLD_Climatology, CMAP_mlpd_dt_argo_clim_tblArgo_MLD_Climatology, CMAP_mld_da_mean_argo_clim_tblArgo_MLD_Climatology, CMAP_mld_dt_mean_argo_clim_tblArgo_MLD_Climatology, CMAP_PSAL_ADJUSTED_tblArgoCore_REP, CMAP_TEMP_ADJUSTED_tblArgoCore_REP, CMAP_BISULFIDE_ADJUSTED_tblArgoBGC_REP, CMAP_CHLA_ADJUSTED_tblArgoBGC_REP, CMAP_CDOM_ADJUSTED_tblArgoBGC_REP, CMAP_DOXY_ADJUSTED_tblArgoBGC_REP, CMAP_DOXY2_ADJUSTED_tblArgoBGC_REP, CMAP_DOWN_IRRADIANCE380_ADJUSTED_tblArgoBGC_REP, CMAP_DOWN_IRRADIANCE412_ADJUSTED_tblArgoBGC_REP, CMAP_DOWN_IRRADIANCE443_ADJUSTED_tblArgoBGC_REP, CMAP_DOWN_IRRADIANCE490_ADJUSTED_tblArgoBGC_REP, CMAP_DOWN_IRRADIANCE555_ADJUSTED_tblArgoBGC_REP, CMAP_DOWNWELLING_PAR_dPRES_tblArgoBGC_REP, CMAP_DOWNWELLING_PAR_ADJUSTED_tblArgoBGC_REP, CMAP_BBP470_ADJUSTED_tblArgoBGC_REP, CMAP_BBP532_ADJUSTED_tblArgoBGC_REP, CMAP_BBP700_ADJUSTED_tblArgoBGC_REP, CMAP_BBP700_2_ADJUSTED_tblArgoBGC_REP, CMAP_CP660_ADJUSTED_tblArgoBGC_REP, CMAP_PSAL_ADJUSTED_tblArgoBGC_REP, CMAP_PH_IN_SITU_TOTAL_ADJUSTED_tblArgoBGC_REP, CMAP_TEMP_ADJUSTED_tblArgoBGC_REP, CMAP_TURBIDITY_ADJUSTED_tblArgoBGC_REP, CMAP_UP_RADIANCE412_ADJUSTED_tblArgoBGC_REP, CMAP_UP_RADIANCE443_ADJUSTED_tblArgoBGC_REP, CMAP_UP_RADIANCE490_ADJUSTED_tblArgoBGC_REP, CMAP_UP_RADIANCE555_ADJUSTED_tblArgoBGC_REP, CMAP_NITRATE_ADJUSTED_tblArgoBGC_REP, CMAP_C_an_clim_tblWOA_2018_1deg_Climatology, CMAP_C_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_s_an_clim_tblWOA_2018_1deg_Climatology, CMAP_s_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_t_an_clim_tblWOA_2018_1deg_Climatology, CMAP_t_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_A_an_clim_tblWOA_2018_1deg_Climatology, CMAP_A_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_O_an_clim_tblWOA_2018_1deg_Climatology, CMAP_O_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_i_an_clim_tblWOA_2018_1deg_Climatology, CMAP_i_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_n_an_clim_tblWOA_2018_1deg_Climatology, CMAP_n_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_p_an_clim_tblWOA_2018_1deg_Climatology, CMAP_p_mn_clim_tblWOA_2018_1deg_Climatology, CMAP_C_an_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_C_mn_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_s_an_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_s_mn_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_t_an_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_t_mn_clim_tblWOA_2018_qrtdeg_Climatology, CMAP_M_an_clim_tblWOA_2018_MLD_qrtdeg_Climatology, CMAP_M_mn_clim_tblWOA_2018_MLD_qrtdeg_Climatology FROM tblHOT_PP t1                             LEFT JOIN tblAncillary t2 ON t1.[time]=t2.[time] AND ABS(t1.lat-t2.lat)<0.0001 AND ABS(t1.lon-t2.lon)<0.0001 AND ABS(t1.depth-t2.depth)<0.001                            WHERE                             t2.link='tblHOT_PP'                          ";

const q3 = `SELECT TOP (1000) [ID],[User_ID]
      ,[Route_ID]
      ,[Query]
      ,[URL_Path]
  FROM [Opedia].[dbo].[tblApi_Calls]
  WHERE ID = 56305734`;

const q4 = `EXEC uspAddAncillary 'tblFalkor_2018', '2018-03-12','2018-04-10', 21.3, 24.7, -160.9, -155,4, 1001, 0`;

// taken from depth profile
const q10 =  `EXEC uspDepthProfile '[tblKM1709_mesoscope]', '[CTD_Chloropigment]', '2017-06-26', '2017-07-12T23:59:59', '21.19', '27.952', '-158.918', '-157.284', '3.9', '695.1'`;

const q5 = `                        select Table_Name [name], count(Table_Name) [weight] from tblAPI_Query q                         --join tblApi_Calls c on c.id=q.call_id                        --where c.user_id not in (1,2,3,4,5,6,7,10)                                                 group by Table_Name order by [weight] desc                       `;

const q6 = `/* EXEC sproc 'tblFakeTable'*/ SELECT * from tblMyTable`;

const q7 = `-- EXEC sproc tblFakeTable
            SELECT * from tblMyTable`;

const q8 = `SELECT -- weird EXEC comment
            * from tblMyTable`;

// CTE
const q9 = `WITH cruise_join (time, lat, lon) AS
(SELECT DISTINCT i.time, i.lat, i.lon FROM tblTN398_Influx_Underway i
        INNER JOIN tblTN398_Nutrients n on CAST(i.time as date) = CAST(n.time as date)
)
SELECT * from cruise_join c INNER JOIN tblTN398_uw_TSG t on c.time  = t.time`;

const q11 = `SELECT COLUMN_NAME [Columns] FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'tblESV'`;

const q12 = `EXEC uspSpaceTime '[tblDarwin_Nutrient]', '[*]', '1994-01-03', '1994-02-03', '-90', '90', '-180', '180', '0', '10'`;

// q13 tests that we correctly handle a newline adjacent to a table name
const q13 = `SELECT [time], AVG(lat) AS lat, AVG(lon) AS lon, AVG(sst) AS sst, STDEV(sst) AS sst_std FROM tblsst_AVHRR_OI_NRT
         WHERE
         [time] BETWEEN '2016-06-01' AND '2016-10-01' AND
         lat BETWEEN 23 AND 24 AND
         lon BETWEEN -160 AND -158
         GROUP BY [time]
         ORDER BY [time]`;

const records = [
  [q1, custom, ["tblOrgSubTrophics"]], // test simple query
  [q2, custom, ["tblHOT_PP", "tblAncillary"]], // test join of two tables
  [q3, custom, ["tblApi_Calls"]], // test that bracket escaped variables work
  [q4, sproc, ["tblFalkor_2018"]], // test exec
  [q5, custom, ["tblAPI_Query"]], // test -- comments
  [q6, custom, ["tblMyTable"]], // commented out EXEC with actual SELECT
  [q7, custom, ["tblMyTable"]], // commented out EXEC with actual SELECT
  [q8, custom, ["tblMyTable"]], // mid-command comment
  [q9, custom, ["tblTN398_Influx_Underway", "tblTN398_Nutrients", "cruise_join", "tblTN398_uw_TSG"]],
  [q10, sproc, ["tblKM1709_mesoscope"]],
  [q11, custom, ["COLUMNS", "tblESV"]], // note that even though "COLUMNS" is not a real table, it will be removed
  // when checked against the list of table names
  [q12, sproc, ["tblDarwin_Nutrient"]],
  [q13, custom, ["tblsst_AVHRR_OI_NRT"]]
];

module.exports = {
  q1,
  q2,
  q3,
  q4,
  q5,
  records,
};
