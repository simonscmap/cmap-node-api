(this.webpackJsonpcmap_react=this.webpackJsonpcmap_react||[]).push([[12],{647:function(e,a,t){"use strict";a.a={default:{title:"Simons Collaborative Marine Ocean Atlas",description:"Simons Collaborative Marine Atlas Project is an open-source data portal interconnecting data sets across Oceanography disciplines. It enables scientists and the public to dive into the vast and often underutilized ocean datasets to retrieve custom subsets of data."},visualization:{title:"CMAP Data Visualization",description:"Generate scatter plots, heatmaps, cruise routes, and more using oceanographic data from from CMAP datasets."},catalog:{title:"CMAP Catalog",description:"Search for oceanographic datasets in the CMAP database using keywords, or temporal or spatial coverage."},dataSubmission:{title:"CMAP Data Submission",description:"Validate and submit your dataset. Track the progress of your previous submissions."},community:{title:"CMAP Community",description:"Join the CMAP team on slack, follow us on github, or download the CMAP software package for Python, R, Julia, or MATLAB."}}},653:function(e,a,t){"use strict";var n=[5,15,25,35,45,55,65,75.005,85.025,95.095,105.31,115.87,127.15,139.74,154.47,172.4,194.735,222.71,257.47,299.93,350.68,409.93,477.47,552.71,634.735,722.4,814.47,909.74,1007.155,1105.905,1205.535,1306.205,1409.15,1517.095,1634.175,1765.135,1914.15,2084.035,2276.225,2491.25,2729.25,2990.25,3274.25,3581.25,3911.25,4264.25,4640.25,5039.25,5461.25,5906.25],l=[.494024991989,1.54137504101,2.64566898346,3.81949496269,5.07822418213,6.44061422348,7.92956018448,9.5729970932,11.404999733,13.4671401978,15.8100700378,18.4955596924,21.5988197327,25.2114105225,29.4447307587,34.4341506958,40.3440513611,47.3736915588,55.764289856,65.8072662354,77.8538513184,92.3260726929,109.729301453,130.666000366,155.850692749,186.125595093,222.475204468,266.040313721,318.127410889,380.213012695,453.937713623,541.088928223,643.566772461,763.333129883,902.339294434,1062.43994141,1245.29101562,1452.25097656,1684.28405762,1941.89294434,2225.07788086,2533.3359375,2865.70288086,3220.82006836,3597.03198242,3992.48388672,4405.22412109,4833.29101562,5274.78417969,5727.91699219],r=new Set(["tblPisces_NRT","tblPisces_NRT_Calendar"]),o=new Set(["tblDarwin_Chl_Climatology","tblDarwin_Ecosystem","tblDarwin_Nutrient","tblDarwin_Nutrient_Climatology","tblDarwin_Ocean_Color","tblDarwin_Phytoplankton","tblDarwin_Plankton_Climatology"]),i={count:function(e,a,t){var i=e.data.Table_Name,s=0;if(r.has(i))for(var m=0;m<l.length&&!(l[m]>t);m++)l[m]>a&&s++;else if(o.has(i))for(var c=0;c<n.length&&!(n[c]>t);c++)n[c]>a&&s++;return s},piscesTable:r,darwinTable:o,piscesDepths:l,darwinDepths:n};a.a=i},680:function(e,a){},681:function(e,a,t){"use strict";var n=t(0),l=t.n(n),r=t(720);a.a=function(e){return e.loading?l.a.createElement(l.a.Fragment,null,e.children.map((function(e,a){return l.a.createElement(r.a,{key:a},e)}))):l.a.createElement(l.a.Fragment,null,e.children.map((function(e,a){return l.a.createElement(l.a.Fragment,{key:a},e)})))}},700:function(e,a){},701:function(e,a){},880:function(e,a,t){"use strict";t.r(a);var n=t(62),l=t(0),r=t.n(l),o=t(39),i=t(38),s=t(247),m=t(244),c=t(85),d=t(663),u=t(666),p=t(664),h=t(665),b=t(566),g=t(15),f=t(670),x=t.n(f),E=t(698),_=t.n(E),v=t(835),w=t.n(v),y=t(561),N=t(629),M=t(723),D=t(722),S=t(636),T=t(871),L=t(872),k=t(702),C=t(251),P=function(e){return r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,null,"This table contains information about the variables belonging to this dataset including general information, temporal and spatial coverage, and summary statistics."),r.a.createElement(c.a,{style:{marginTop:"12px"}},"Enter a search term into the variable filter to quickly filter by variable name, sensor, or other keyword."),r.a.createElement("img",{src:"/images/help_variable_grid_filter.png",style:{margin:"20px auto",display:"block",width:"480px",maxWidth:"80vw"},alt:"Using Quick Filter"}),r.a.createElement(c.a,{style:{marginTop:"12px"}},"Click any column header to sort the table by the values in that column. Click again to reverse the sort order."),r.a.createElement("img",{src:"/images/help_variable_grid_sort.gif",style:{margin:"20px auto",display:"block",width:"400px",maxWidth:"80vw"},alt:"Multiple Keyword Example"}),r.a.createElement(c.a,{style:{marginTop:"12px"}},"To download the variable table in csv format right click on any cell and click CSV Export."),r.a.createElement("img",{src:"/images/help_variable_grid_export.png",style:{margin:"20px auto",display:"block",width:"480px",maxWidth:"80vw"},alt:"Multiple Keyword Example"}))},V=t(32),R=Object(g.a)((function(e){return{dialogPaper:{backgroundColor:V.a.solidPaper,color:"white",padding:"12px"}}}))((function(e){var a=e.value,t=e.classes,l=r.a.useState(!1),o=Object(n.a)(l,2),i=o[0],s=o[1];return!e.value||(e.value&&e.value.length)<20?e.value:r.a.createElement(r.a.Fragment,null,r.a.createElement(b.a,{component:"button",style:{color:V.a.primary,fontSize:"12px",lineHeight:"38px"},onClick:function(){return s(!0)}},"View Comment"),r.a.createElement(y.a,{open:i,onClose:function(){return s(!1)},classes:{paper:t.dialogPaper}},r.a.createElement(x.a,{source:a})))})),F=[{headerName:"General Information",children:[{headerName:"Variable Name",field:"Long_Name",tooltipField:"Long_Name"},{headerName:"Short Name",field:"Variable"},{headerName:"Sensor",field:"Sensor"},{headerName:"Unit",field:"Unit"},{headerName:"Comment",field:"Comment",tooltipField:"Comment",cellRenderer:"commentCellRenderer"}]},{headerName:"Coverage",children:[{headerName:"Lat Start",field:"Lat_Min"},{headerName:"Lat_End",field:"Lat_Max"},{headerName:"Lon Start",field:"Lon_Min"},{headerName:"Long End",field:"Lon_Max"},{headerName:"Time Start",field:"Time_Min"},{headerName:"Time End",field:"Time_Max"},{headerName:"Depth Start",field:"Depth_Min"},{headername:"Depth End",field:"Depth_Max"}]},{headerName:"Table Statistics",children:[{headerName:"Database Row Count",field:"Variable_Count"},{headerName:"Mean Value",field:"Variable_Mean"},{headerName:"Min Value",field:"Variable_Min"},{headerName:"Max Value",field:"Variable_Max"},{headerName:"STD",field:"Variable_STD"},{headerName:"25th Quantile",field:"Variable_25th"},{headerName:"50th Quantile",field:"Variable_50th"},{headerName:"75th Quantile",field:"Variable_75th"},{headerName:"Keywords",field:"Keywords",hide:!0}]}],A={cellStyle:{fontSize:"12px",lineHeight:"38px"},menuTabs:[],suppressMovable:!0,sortable:!0},O=r.a.memo((function(e){var a=e.Variables,t=e.classes,o=Object(l.useState)(""),i=Object(n.a)(o,2),s=i[0],m=i[1];return r.a.createElement("div",null,r.a.createElement(N.a,{className:t.gridSearch,margin:"normal",type:"text",variant:"outlined",name:"quickSearch",value:s,label:"Variable Filter",onChange:function(e){return m(e.target.value)},InputProps:{startAdornment:r.a.createElement(M.a,{position:"start"},r.a.createElement(D.a,{style:{color:V.a.primary}}))}}),r.a.createElement(C.a,{title:"Variable Table",content:r.a.createElement(P,null),buttonClass:t.helpButton}),r.a.createElement("div",{className:t.gridWrapper+" ag-theme-material",style:{height:"".concat(60*a.length+200,"px"),maxHeight:"600px"}},r.a.createElement(k.AgGridReact,{columnDefs:F,defaultColDef:A,rowData:a,onGridReady:function(e){return e.columnApi.autoSizeAllColumns()},enableCellTextSelection:!0,rowHeight:38,enableBrowserTooltips:!0,cacheQuickFilter:!0,quickFilterText:s,getContextMenuItems:function(){return["copy","csvExport"]},icons:{menu:w.a.renderToString(r.a.createElement(S.a,{style:{fontSize:"1.2rem",color:V.a.primary}})),sortAscending:w.a.renderToString(r.a.createElement(T.a,{style:{fontSize:"1.2rem",color:V.a.primary}})),sortDescending:w.a.renderToString(r.a.createElement(L.a,{style:{fontSize:"1.2rem",color:V.a.primary}}))},frameworkComponents:{commentCellRenderer:R}})))})),H=Object(g.a)((function(e){return{gridWrapper:{border:"1px solid black"},helpButton:{margin:"0 0 -40px 6px"}}}))(O),j=t(59),I=function(e){var a=e.keywords&&e.keywords.length?[].concat(Object(j.a)(Array.from(new Set(e.Keywords.split(","))).map((function(e){return e.trim()}))),["oceanography"]):[],t={"@context":"https://schema.org/","@type":"Dataset",name:e.Long_Name,description:e.Description,keywords:a,alternateName:e.Short_Name,citation:e.References||"",measurementTechnique:e.sensors,hasPart:e.Variables.map((function(a){return{"@type":"Dataset",name:a.Long_Name,description:"".concat(a.Long_Name," measured via ").concat(a.Sensor," in ").concat(a.Unit,". Part of dataset ").concat(e.Long_Name),creator:{"@type":"Organization",name:e.Data_Source}}})),creator:{"@type":"Organization",name:e.Data_Source},includedInDataCatalog:{"@type":"DataCatalog",name:"simonscmap.com"},temporalCoverage:e.Time_Min&&e.Time_Max?"".concat(e.Time_Min.slice(0,10),"/").concat(e.Time_Max.slice(0,10)):"",spatialCoverage:{"@type":"Place",geo:{"@type":"GeoShape",box:"".concat(e.Lat_Min," ").concat(e.Lon_Min," ").concat(e.Lat_Max," ").concat(e.Lon_Max)}}};return r.a.createElement("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(t)}})},z=t(3),B=t(51),W=t(52),G=t(88),q=t(87),K=t(564),J=t(565),Q=t(886),U=t(630),Y=t(245),X=Object(g.a)((function(e){return{}}))((function(e){e.classes;return r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,null,"This component allows you to download a csv file containing data from this dataset. Depending on the size of the dataset you may be able to download it in its entirety, or may need to specify a subset using the sliders or form fields, the minimum and maximum values of which represent the dataset's spatial and temporal boundaries."),r.a.createElement(c.a,null,"If the subset is too large you will see text instructing you to reduce the size of the subset, as below:"),r.a.createElement("img",{src:"/images/help_catalog_downloading_data_too_large.png",style:{margin:"20px auto",display:"block",width:"480px",maxWidth:"80vw"},alt:"Subset Too Large Example"}),r.a.createElement(c.a,null,'Adjust the any of subset parameters until the download size is within the allowed range, and click "Download Subset":'),r.a.createElement("img",{src:"/images/help_catalog_downloading_data_valid.png",style:{margin:"20px auto",display:"block",width:"480px",maxWidth:"80vw"},alt:"Valid Download Example"}))})),Z=t(34),$=t(89),ee=t(653),ae={csvDownloadRequestSend:Z.m},te=function(e,a){var t=new Date(e);t.setDate(t.getDate()+a);var n=t.getMonth()+1;n=n>9?n:"0"+n;var l=t.getDate();return l=l>9?l:"0"+l,"".concat(t.getFullYear(),"-").concat(n,"-").concat(l)},ne=function(e,a){return Math.ceil((new Date(a).getTime()-new Date(e).getTime())/864e5)},le=function(e){Object(G.a)(t,e);var a=Object(q.a)(t);function t(e){var n;Object(B.a)(this,t),(n=a.call(this,e)).handleSetStartDate=function(e){if(e.target.value){var a=e.target.value.split("-"),t=new Date(a[0],parseInt(a[1])-1,a[2]),l=new Date(n.props.dataset.Time_Min),r=new Date(n.props.dataset.Time_Max),o=t<l?l:t>r?r:t;n.setState(Object(z.a)(Object(z.a)({},n.state),{},{time:[ne(n.props.dataset.Time_Min,o),n.state.time[1]]}))}},n.handleSetEndDate=function(e){if(e.target.value){var a=e.target.value.split("-"),t=new Date(a[0],parseInt(a[1])-1,a[2]),l=new Date(n.props.dataset.Time_Min),r=new Date(n.props.dataset.Time_Max),o=t<l?l:t>r?r:t;n.setState(Object(z.a)(Object(z.a)({},n.state),{},{time:[n.state.time[0],ne(n.props.dataset.Time_Min,o)]}))}},n.handleFullDatasetDownload=function(e){var a="select%20*%20from%20".concat(e),t=n.props.dataset.Long_Name;n.props.csvDownloadRequestSend(a,t,e)},n.handleSubsetDownload=function(e,a,t,l,r,o,i,s,m){var c=Boolean(n.props.dataset.Temporal_Resolution===$.a.monthlyClimatology),d=c?"month":"time",u=c?new Date(a).getMonth()+1:a,p=c?new Date(t).getMonth()+1:t,h="select * from ".concat(e," where ").concat(d," between '").concat(u,"' and '").concat(p,"' and ")+"lat between ".concat(l," and ").concat(r," and ")+"lon between ".concat(o," and ").concat(i);Boolean(n.props.dataset.Depth_Max)&&(h+=" and depth between ".concat(s," and ").concat(m));var b=n.props.dataset.Long_Name;n.props.csvDownloadRequestSend(h,b,e)},n.handleSliderChange=function(e,a){n.setState(Object(z.a)(Object(z.a)({},n.state),{},{[e]:a}))};var l=Math.ceil((new Date(n.props.dataset.Time_Max).getTime()-new Date(n.props.dataset.Time_Min).getTime())/864e5);return n.state={lat:[Math.floor(10*n.props.dataset.Lat_Min)/10,Math.ceil(10*n.props.dataset.Lat_Max)/10],lon:[Math.floor(10*n.props.dataset.Lon_Min)/10,Math.ceil(10*n.props.dataset.Lon_Max)/10],time:n.props.dataset.Time_Min?[0,l]:[1,12],depth:[Math.floor(n.props.dataset.Depth_Min),Math.ceil(n.props.dataset.Depth_Max)],maxDays:l},n}return Object(W.a)(t,[{key:"render",value:function(){var e=this,a=this.props,t=a.dataset,n=a.dialogOpen,l=a.handleClose,o=a.classes,i=t.Lat_Min,m=t.Lat_Max,d=t.Lon_Min,u=t.Lon_Max,p=t.Time_Min,h=t.Time_Max,b=t.Depth_Min,g=t.Depth_Max,f=(t.Spatial_Resolution,t.Temporal_Resolution),x=t.Table_Name,E=t.Row_Count,_=this.state,v=_.lat,w=_.lon,M=_.time,D=_.depth,S=parseFloat(i),T=parseFloat(m),L=parseFloat(d),k=parseFloat(u),P=Date.parse(p),V=Date.parse(h),R=v[0],F=v[1],A=w[0],O=w[1],H=M[0],j=M[1],I=f===$.a.monthlyClimatology;if(g)var z=parseFloat(b),B=parseFloat(g),W=D[0],G=D[1];var q,Z=E*((t.Variables&&t.Variables.length)+(t.Depth_Max?1:0)+3),ae=Z<2e7;if(f===$.a.monthlyClimatology)q=(M[1]-M[0]+1)/12;else{var ne=(V-P)/864e5||1,le=j-H<1?1:j-H;q=ne>le?le/ne:1}var re=T-S||1,oe=(F-R||1/re)/re,ie=k-L||1,se=(O-A||1/ie)/ie,me=1;if(g)if(ee.a.piscesTable.has(x))me=ee.a.count({data:t},W,G)/ee.a.piscesDepths.length||1;else if(ee.a.darwinTable.has(x)){me=ee.a.count({data:t},W,G)/ee.a.darwinDepths.length||1}else{var ce=B-z||1,de=G-W||1;me=de>ce?1:de/ce}var ue=Math.floor(Z*q*oe*se*me),pe=ue<=2e7,he=I?M[0]:te(p,H),be=I?M[1]:te(p,j);return r.a.createElement(r.a.Fragment,null,r.a.createElement(y.a,{PaperProps:{className:o.dialogPaper},open:n,onClose:l,maxWidth:!1},r.a.createElement(K.a,null,"Downloading ",t.Long_Name,r.a.createElement(C.a,{title:"Downloading Data",content:r.a.createElement(X,null),buttonClass:o.helpButton})),r.a.createElement(J.a,{style:{padding:"0px 40px"},classes:{root:o.dialogRoot}},r.a.createElement(c.a,null,ae?"The full dataset is available for download.":"The full dataset is too large for download."),r.a.createElement(c.a,null,pe?"The subset described below is available for download.":"The subset described below contains approximately ".concat(ue," data points. Maximum download size is 20000000. Please reduce the range of one or more parameters.")),I?r.a.createElement(r.a.Fragment,null,r.a.createElement(s.a,{container:!0,className:o.formGrid},r.a.createElement(s.a,{item:!0,xs:12,md:4},r.a.createElement(c.a,{className:o.formLabel},"Month")),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"Start",type:"number",inputProps:{min:1,max:12,className:o.input},InputLabelProps:{shrink:!0},value:M[0],onChange:function(a){return e.handleSliderChange("time",[""===a.target.value?"":Number(a.target.value),M[1]])}})),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"End",type:"number",inputProps:{min:1,max:12,className:o.input},InputLabelProps:{shrink:!0},value:M[1],onChange:function(a){return e.handleSliderChange("time",[M[0],""===a.target.value?"":Number(a.target.value)])}}))),r.a.createElement(Q.a,{min:1,max:12,value:["number"===typeof M[0]?M[0]:1,"number"===typeof M[1]?M[1]:12],value:this.state.time,onChange:function(a,t){return e.handleSliderChange("time",t)},classes:{valueLabel:o.sliderValueLabel,thumb:o.sliderThumb,markLabel:o.markLabel},className:o.slider,marks:[{value:1,label:"1"},{value:12,label:"12"}]})):r.a.createElement(r.a.Fragment,null,r.a.createElement(s.a,{container:!0,className:o.formGrid},r.a.createElement(s.a,{item:!0,xs:12,md:4},r.a.createElement(c.a,{className:o.formLabel},"Date")),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"Start",type:"date",inputProps:{className:o.input},InputLabelProps:{shrink:!0},value:te(p,this.state.time[0]),onChange:this.handleSetStartDate})),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"End",type:"date",inputProps:{className:o.input},InputLabelProps:{shrink:!0},value:te(p,this.state.time[1]),onChange:this.handleSetEndDate}))),r.a.createElement(Q.a,{min:0,max:this.state.maxDays,value:this.state.time,onChange:function(a,t){return e.handleSliderChange("time",t)},classes:{valueLabel:o.sliderValueLabel,thumb:o.sliderThumb,markLabel:o.markLabel},className:o.slider,marks:[{value:0,label:te(p,0)},{value:this.state.maxDays,label:te(p,this.state.maxDays)}]})),r.a.createElement(s.a,{container:!0,className:o.formGrid},r.a.createElement(s.a,{item:!0,xs:12,md:4},r.a.createElement(c.a,{className:o.formLabel},"Latitude[","\xb0","]")),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"Start",type:"number",inputProps:{step:.1,min:Math.floor(10*i)/10,max:Math.ceil(10*m)/10,className:o.input},InputLabelProps:{shrink:!0},value:v[0],onChange:function(a){return e.handleSliderChange("lat",[""===a.target.value?"":Number(a.target.value),v[1]])}})),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"End",type:"number",inputProps:{step:.1,min:Math.floor(10*i)/10,max:Math.ceil(10*m)/10,className:o.input},InputLabelProps:{shrink:!0},value:v[1],onChange:function(a){return e.handleSliderChange("lat",[v[0],""===a.target.value?"":Number(a.target.value)])}}))),r.a.createElement(Q.a,{min:Math.floor(10*i)/10,max:Math.ceil(10*m)/10,step:.1,value:["number"===typeof v[0]?v[0]:-90,"number"===typeof v[1]?v[1]:90],onChange:function(a,t){return e.handleSliderChange("lat",t)},classes:{valueLabel:o.sliderValueLabel,thumb:o.sliderThumb,markLabel:o.markLabel},className:o.slider,disabled:i===m,marks:[{value:Math.floor(10*i)/10,label:"".concat(Math.floor(10*i)/10)},{value:Math.ceil(10*m)/10,label:"".concat(Math.ceil(10*m)/10)}]}),r.a.createElement(s.a,{container:!0,className:o.formGrid},r.a.createElement(s.a,{item:!0,xs:12,md:4},r.a.createElement(c.a,{className:o.formLabel},"Longitude[","\xb0","]")),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"Start",type:"number",inputProps:{step:.1,min:Math.floor(10*d)/10,max:Math.ceil(10*u)/10,className:o.input},InputLabelProps:{shrink:!0},value:w[0],onChange:function(a){return e.handleSliderChange("lon",[""===a.target.value?"":Number(a.target.value),w[1]])}})),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"End",type:"number",inputProps:{step:.1,min:Math.floor(10*d)/10,max:Math.ceil(10*u)/10,className:o.input},InputLabelProps:{shrink:!0},value:w[1],onChange:function(a){return e.handleSliderChange("lon",[w[0],""===a.target.value?"":Number(a.target.value)])}}))),r.a.createElement(Q.a,{min:Math.floor(10*d)/10,max:Math.ceil(10*u)/10,step:.1,value:["number"===typeof w[0]?w[0]:-90,"number"===typeof w[1]?w[1]:90],onChange:function(a,t){return e.handleSliderChange("lon",t)},classes:{valueLabel:o.sliderValueLabel,thumb:o.sliderThumb,markLabel:o.markLabel},className:o.slider,disabled:d===u,marks:[{value:Math.floor(10*d)/10,label:"".concat(Math.floor(10*d)/10)},{value:Math.ceil(10*u)/10,label:"".concat(Math.ceil(10*u)/10)}]}),g?r.a.createElement(r.a.Fragment,null,r.a.createElement(s.a,{container:!0,className:o.formGrid},r.a.createElement(s.a,{item:!0,xs:12,md:4},r.a.createElement(c.a,{className:o.formLabel},"Depth[m]")),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"Start",type:"number",inputProps:{min:Math.floor(b),max:Math.ceil(g),className:o.input},InputLabelProps:{shrink:!0},value:D[0],onChange:function(a){return e.handleSliderChange("depth",[""===a.target.value?"":Number(a.target.value),D[1]])}})),r.a.createElement(s.a,{item:!0,xs:6,md:4},r.a.createElement(N.a,{label:"End",type:"number",inputProps:{min:Math.floor(b),max:Math.ceil(g),className:o.input},InputLabelProps:{shrink:!0},value:D[1],onChange:function(a){return e.handleSliderChange("depth",[v[0],""===a.target.value?"":Number(a.target.value)])}}))),r.a.createElement(Q.a,{min:Math.floor(b),max:Math.ceil(g),value:["number"===typeof D[0]?D[0]:-90,"number"===typeof D[1]?D[1]:90],onChange:function(a,t){return e.handleSliderChange("depth",t)},classes:{valueLabel:o.sliderValueLabel,thumb:o.sliderThumb,markLabel:o.markLabel},className:o.slider,marks:[{value:Math.floor(b),label:"".concat(Math.floor(b))},{value:Math.ceil(g),label:"".concat(Math.ceil(g))}]})):""),r.a.createElement(U.a,{style:{marginTop:"8px"}},r.a.createElement(Y.a,{onClick:l},"Cancel"),pe&&r.a.createElement(Y.a,{onClick:function(){return e.handleSubsetDownload(x,he,be,R,F,A,O,W,G)}},"Download Subset"),ae&&r.a.createElement(Y.a,{onClick:function(){return e.handleFullDatasetDownload(x)}},"Download Full Dataset"))))}}]),t}(l.Component),re=Object(o.b)((function(e,a){return{datasets:e.datasets,catalog:e.catalog}}),ae)(Object(g.a)((function(e){return{dialogPaper:{backgroundColor:V.a.solidPaper,"@media (max-width: 600px)":{width:"100vw",margin:"12px"},width:"60vw"},sliderValueLabel:{top:-22,"& *":{background:"transparent",color:e.palette.primary.main},left:-14},slider:{margin:"4px 8px 8px 0px"},sliderThumb:{borderRadius:"0px",height:"16px",width:"3px",marginLeft:0,marginTop:"-7px"},dialogRoot:{overflowY:"visible"},markLabel:{top:30,fontSize:".7rem"},input:{fontSize:"13px",padding:"2px 0"},formGrid:{marginTop:"16px"},formLabel:{marginTop:"13px",fontSize:".92rem"},helpButton:{marginTop:"-2px"},closeDialogIcon:{float:"right",marginTop:"-12px",marginRight:"-8px"}}}))(le)),oe=t(43),ie=t(18),se=t(647),me=t(263),ce=t(681),de=(t(382),function(e){var a=[];a.push({dataset_short_name:e.Short_Name,dataset_long_name:e.Long_Name,dataset_version:e.Dataset_Version||"",dataset_release_date:e.Dataset_Release_Date||"",dataset_make:e.Variables[0].Make,dataset_source:e.Data_Source||"",dataset_distributor:e.Distributor||"",dataset_acknowledgement:e.Acknowledgement||"",dataset_history:e.Dataset_History||"",dataset_description:e.Description||"",dataset_references:e.References[0]||"",climatology:e.Climatology||0,cruise_names:e.Cruises[0]?e.Cruises[0].Name:""}),e.Cruises.forEach((function(e,t){t>0&&a.push({cruise_names:e.Name})})),e.References.forEach((function(e,t){t>0&&(a[t]?a[t].dataset_references=e:a.push({dataset_references:e}))}));var t=[],n=[];return console.log(e),e.Variables.forEach((function(e,a){t.push({var_short_name:e.Variable,var_long_name:e.Long_Name,var_sensor:e.Sensor,var_unit:e.Unit||"",var_spatial_res:e.Spatial_Resolution,var_temporal_res:e.Temporal_Resolution,var_discipline:e.Study_Domain,visualize:e.Visualize?1:0,var_keywords:e.Keywords||"",var_comment:e.Comment||""}),n.push({Variable:e.Long_Name,Time_Min:e.Time_Min||"NA",Time_Max:e.Time_Max||"NA",Lat_Min:e.Lat_Min||"NA",Lat_Max:e.Lat_Max||"NA",Lon_Min:e.Lon_Min||"NA",Lon_Max:e.Lon_Max||"NA",Variable_Mean:e.Variable_Mean||"NA",Variable_STD:e.Variable_STD||"NA",Variable_Min:e.Variable_Min||"NA",Variable_Max:e.Variable_Max||"NA",Variable_25th:e.Variable_25th||"NA",Variable_50th:e.Variable_50th||"NA",Variable_75th:e.Variable_75th||"NA"})})),{datasetRows:a,variableRows:t,summaryStatisticsRows:n}}),ue={datasetFullPageDataFetch:oe.h,datasetFullPageDataStore:oe.j};a.default=Object(o.b)((function(e,a){return{datasetFullPageDataLoadingState:e.datasetFullPageDataLoadingState,datasetFullPageData:e.datasetFullPageData}}),ue)(Object(g.a)((function(e){return{stickyPaper:{position:"-webkit-sticky",maxHeight:"calc(100vh - 128px)",position:"sticky",top:"90px",width:"160px",marginLeft:"20px",paddingLeft:"12px",backgroundColor:"rgba(0,0,0,.4)",overflow:"auto"},guideSection:{width:"80%",margin:"20px auto 0 auto",textAlign:"left",padding:"12px 32px",[e.breakpoints.down("sm")]:{padding:"12px 12px",margin:"16px auto 16px auto",width:"90%"},fontFamily:'"roboto", Serif',backgroundColor:"rgba(0,0,0,.4)",marginBottom:"20px"},sectionHeader:{margin:"16px 0 2px 0",fontWeight:100,fontFamily:'"roboto", Serif'},"@media screen and (max-width: 1300px)":{stickyPaper:{display:"none"}},navListItem:{color:e.palette.primary.main,padding:"2px 10px 2px 6px"},navListItemText:{"&:hover":{textDecoration:"underline"}},doiListItem:{color:e.palette.primary.main,padding:"0 10px 0 6px",width:"max-content"},doiListItemText:{fontSize:"16px","&:hover":{textDecoration:"underline"}},doiListItemtextWrapper:{margin:"0"},navListItemtextWrapper:{margin:"2px 0"},subListText:{margin:0,"&:hover":{textDecoration:"underline"}},anchor:{display:"block",position:"relative",top:"-120px",visibility:"hidden"},divider:{backgroundColor:e.palette.primary.main,marginBottom:"8px"},sampleTableRow:{"& td":{padding:"10px 24px 10px 16px"}},navListSubItemText:{fontSize:".785rem"},navListSubSubItemText:{fontSize:".7rem"},outerContainer:{marginTop:"70px",color:"white"},markdown:{"& img":{maxWidth:"100%",margin:"20px auto 20px auto",display:"block"},"& a":{color:e.palette.primary.main,textDecoration:"none"},"& p":{fontSize:"1rem",fontFamily:'"Lato",sans-serif',fontWeight:400,lineHeight:1.5}},smallText:{fontSize:".8rem"},tableHead:{fontWeight:600},variableLongName:{color:e.palette.primary.main},pageHeader:{[e.breakpoints.down("sm")]:{fontSize:"1.4rem"}},helpIcon:{fontSize:"1.2rem"},helpButton:{padding:"12px 12px 12px 8px"},cartButtonClass:{textTransform:"none",color:e.palette.primary.main,marginTop:"16px"},cruiseLink:{display:"block",marginBottom:"3px",color:V.a.primary}}}))((function(e){var a=e.classes,t=e.datasetFullPageDataFetch,o=e.datasetFullPageDataStore,g=e.datasetFullPageData,f=e.datasetFullPageDataLoadingState,E=g.Variables,v=g.Acknowledgement,w=g.Data_Source,y=g.Depth_Max,N=g.Depth_Min,M=g.Description,D=g.Distributor,S=g.Lat_Max,T=g.Lat_Min,L=g.Lon_Max,k=g.Lon_Min,P=g.Long_Name,R=g.Short_Name,F=g.Table_Name,A=g.Time_Max,O=g.Time_Min,j=g.References,z=g.Make,B=g.Process_Level,W=g.Spatial_Resolution,G=g.Temporal_Resolution,q=g.Sensors,K=g.Cruises,J=f===ie.a.inProgress,Q=r.a.useState(!1),U=Object(n.a)(Q,2),Y=U[0],X=U[1];Object(l.useEffect)((function(){return t(e.match.params.dataset),function(){return o({})}}),[]),Object(l.useEffect)((function(){return document.title=P||se.a.defaultTitle,document.description=M||se.a.default.description,function(){document.title=se.a.default.title,document.description=se.a.default.description}}),[P]);return r.a.createElement(s.a,{container:!0,className:a.outerContainer},Y?r.a.createElement(re,{dialogOpen:Y,dataset:g,handleClose:function(){return X(!1)}}):"",r.a.createElement(s.a,{item:!0,xs:12},r.a.createElement(m.a,{className:a.guideSection,elevation:4},r.a.createElement(ce.a,{loading:J},r.a.createElement("a",{className:a.anchor,id:"description"}),r.a.createElement(c.a,{variant:"h4",className:a.pageHeader,style:{color:"white"}},P),r.a.createElement(x.a,{source:M,className:a.markdown}),r.a.createElement("a",{className:a.anchor,id:"info-table"}),r.a.createElement(d.a,{size:"small",style:{marginTop:"24px",maxWidth:"800px"}},r.a.createElement(u.a,null,r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Make"),r.a.createElement(h.a,null,z)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Sensor",q&&q.length>1?"s":""),r.a.createElement(h.a,null,q?q.join(", "):"")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Process Level"),r.a.createElement(h.a,null,B)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Database Table Name"),r.a.createElement(h.a,null,F)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Database Dataset Name"),r.a.createElement(h.a,null,R)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Temporal Resolution"),r.a.createElement(h.a,null,G)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Time Start*"),r.a.createElement(h.a,null,O?O.slice(0,10):"NA")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Time End*"),r.a.createElement(h.a,null,A?A.slice(0,10):"NA")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Spatial Resolution"),r.a.createElement(h.a,null,W)),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Lat Start*"),r.a.createElement(h.a,null,T,"\xb0")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Lat End*"),r.a.createElement(h.a,null,S,"\xb0")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Lon Start*"),r.a.createElement(h.a,null,k,"\xb0")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Lon End*"),r.a.createElement(h.a,null,L,"\xb0")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Depth Start*"),r.a.createElement(h.a,null,y?N+"m":"Surface Only")),r.a.createElement(p.a,{className:a.sampleTableRow},r.a.createElement(h.a,{className:a.tableHead},"Depth End*"),r.a.createElement(h.a,null,y?y+"m":"Surface Only")))),r.a.createElement(c.a,{variant:"caption",style:{margin:"4px 0 14px 4px",display:"inline-block",color:"white"}},"*Temporal and spatial coverage may differ between member variables"),r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{marginBottom:"16px",color:"white"}},r.a.createElement("a",{className:a.anchor,id:"variables"}),"Variables"),E?r.a.createElement(H,{Variables:E}):"",w||J?r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},r.a.createElement("a",{className:a.anchor,id:"data-source"}),"Data Source"),r.a.createElement(c.a,{className:a.smallText,style:{color:"white"}},w)):"",D||J?r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},r.a.createElement("a",{className:a.anchor,id:"distributor"}),"Distributor"),r.a.createElement(c.a,{className:a.smallText,style:{color:"white"}},D)):"",v||J?r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},r.a.createElement("a",{className:a.anchor,id:"acknowledgement"}),"Acknowledgement"),r.a.createElement(c.a,{className:a.smallText,style:{color:"white"}},v)):"",j&&j.length||J?r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},r.a.createElement("a",{className:a.anchor,id:"references"}),"References"),J?"":j.map((function(e,t){return r.a.createElement(c.a,{className:a.smallText,key:t,style:{color:"white"}},e)}))):"",K&&K.length?r.a.createElement(r.a.Fragment,null,r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},"Cruises contributing data to this dataset:"),K.map((function(e){return r.a.createElement(b.a,{component:i.b,to:"/catalog/cruises/".concat(e.Name),key:e.Name,className:a.cruiseLink},e.Name)}))):"",r.a.createElement(c.a,{variant:"h5",className:a.sectionHeader,style:{color:"white"}},r.a.createElement("a",{className:a.anchor,id:"data-access"}),"Data Access"),r.a.createElement(b.a,{component:"button",onClick:function(){var e=de(g),a=_.a.utils.book_new();_.a.utils.book_append_sheet(a,_.a.utils.json_to_sheet(e.datasetRows),"Dataset Metadata"),_.a.utils.book_append_sheet(a,_.a.utils.json_to_sheet(e.variableRows),"Variable Metadata"),_.a.utils.book_append_sheet(a,_.a.utils.json_to_sheet(e.summaryStatisticsRows),"Variable Summary Statistics"),_.a.writeFile(a,"".concat(R,"_Metadata'.xlsx"))},style:{color:V.a.primary}},"Download Dataset Metadata"),r.a.createElement(C.a,{title:"Downloading Metadata",content:r.a.createElement(c.a,null,"This link will download an xlsx workbook with a page containing the dataset's metadata, and a second page containing the metadata of its member variables."),iconClass:a.helpIcon,buttonClass:a.helpButton}),r.a.createElement(b.a,{component:"button",onClick:function(){return X(!0)},style:{color:V.a.primary,display:"block"}},"Download Data"),r.a.createElement(me.a,{dataset:g,cartButtonClass:a.cartButtonClass}),!J&&g&&Object.keys(g).length?r.a.createElement(I,g):""))))})))}}]);
//# sourceMappingURL=12.934eefbd.chunk.js.map