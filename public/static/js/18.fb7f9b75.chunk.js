(this.webpackJsonpcmap_react=this.webpackJsonpcmap_react||[]).push([[18],{652:function(e,r,t){"use strict";function i(){return(i=Object.assign||function(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var i in t)Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i])}return e}).apply(this,arguments)}t.d(r,"a",(function(){return i}))},655:function(e,r,t){"use strict";function i(e,r){if(null==e)return{};var t,i,o=function(e,r){if(null==e)return{};var t,i,o={},n=Object.keys(e);for(i=0;i<n.length;i++)t=n[i],r.indexOf(t)>=0||(o[t]=e[t]);return o}(e,r);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);for(i=0;i<n.length;i++)t=n[i],r.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}t.d(r,"a",(function(){return i}))},667:function(e,r,t){(function(r){var i=t(374),o=t(668),n=t(257).StringDecoder;e.exports=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},a=[];if(r.isBuffer(e)){var s=new n;e=s.write(e)}var u=new o.Stringifier(t);u.push=function(e){e&&a.push(e.toString())};var c,l=i(e);try{for(l.s();!(c=l.n()).done;){var f=c.value;u.write(f)}}catch(d){l.e(d)}finally{l.f()}return u.end(),a.join("")}}).call(this,t(250).Buffer)},668:function(e,r,t){(function(r,o){var n=t(377),a=t(253),s=t(374),u=t(378),c=t(255),l=t(256),f=t(254),d=t(379),v=t(380),h=t(381).Transform,p=r.from([239,187,191]),m=function(e){"use strict";d(o,e);var t=v(o);function o(){var e,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};c(this,o),e=t.call(this,u(u({},{writableObjectMode:!0}),r));var i,n={};for(var a in r)n[_(a)]=r[a];if(i=e.normalize(n))throw i;switch(n.record_delimiter){case"auto":n.record_delimiter=null;break;case"unix":n.record_delimiter="\n";break;case"mac":n.record_delimiter="\r";break;case"windows":n.record_delimiter="\r\n";break;case"ascii":n.record_delimiter="\x1e";break;case"unicode":n.record_delimiter="\u2028"}return e.options=n,e.state={stop:!1},e.info={records:0},!0===n.bom&&e.push(p),f(e),e}return l(o,[{key:"normalize",value:function(e){if(void 0===e.bom||null===e.bom||!1===e.bom)e.bom=!1;else if(!0!==e.bom)return new g("CSV_OPTION_BOOLEAN_INVALID_TYPE",["option `bom` is optional and must be a boolean value,","got ".concat(JSON.stringify(e.bom))]);if(void 0===e.delimiter||null===e.delimiter)e.delimiter=",";else if(r.isBuffer(e.delimiter))e.delimiter=e.delimiter.toString();else if("string"!==typeof e.delimiter)return new g("CSV_OPTION_DELIMITER_INVALID_TYPE",["option `delimiter` must be a buffer or a string,","got ".concat(JSON.stringify(e.delimiter))]);if(void 0===e.quote||null===e.quote)e.quote='"';else if(!0===e.quote)e.quote='"';else if(!1===e.quote)e.quote="";else if(r.isBuffer(e.quote))e.quote=e.quote.toString();else if("string"!==typeof e.quote)return new g("CSV_OPTION_QUOTE_INVALID_TYPE",["option `quote` must be a boolean, a buffer or a string,","got ".concat(JSON.stringify(e.quote))]);if(void 0!==e.quoted&&null!==e.quoted||(e.quoted=!1),void 0!==e.quoted_empty&&null!==e.quoted_empty||(e.quoted_empty=void 0),void 0===e.quoted_match||null===e.quoted_match||!1===e.quoted_match?e.quoted_match=null:Array.isArray(e.quoted_match)||(e.quoted_match=[e.quoted_match]),e.quoted_match){var t,i=s(e.quoted_match);try{for(i.s();!(t=i.n()).done;){var o=t.value,n=o instanceof RegExp;if(!("string"===typeof o)&&!n)return Error("Invalid Option: quoted_match must be a string or a regex, got ".concat(JSON.stringify(o)))}}catch(a){i.e(a)}finally{i.f()}}if(void 0!==e.quoted_string&&null!==e.quoted_string||(e.quoted_string=!1),void 0!==e.eof&&null!==e.eof||(e.eof=!0),void 0===e.escape||null===e.escape)e.escape='"';else if(r.isBuffer(e.escape))e.escape=e.escape.toString();else if("string"!==typeof e.escape)return Error("Invalid Option: escape must be a buffer or a string, got ".concat(JSON.stringify(e.escape)));if(e.escape.length>1)return Error("Invalid Option: escape must be one character, got ".concat(e.escape.length," characters"));if(void 0!==e.header&&null!==e.header||(e.header=!1),e.columns=this.normalize_columns(e.columns),void 0!==e.quoted&&null!==e.quoted||(e.quoted=!1),void 0!==e.cast&&null!==e.cast||(e.cast={}),void 0!==e.cast.bigint&&null!==e.cast.bigint||(e.cast.bigint=function(e){return""+e}),void 0!==e.cast.boolean&&null!==e.cast.boolean||(e.cast.boolean=function(e){return e?"1":""}),void 0!==e.cast.date&&null!==e.cast.date||(e.cast.date=function(e){return""+e.getTime()}),void 0!==e.cast.number&&null!==e.cast.number||(e.cast.number=function(e){return""+e}),void 0!==e.cast.object&&null!==e.cast.object||(e.cast.object=function(e){return JSON.stringify(e)}),void 0!==e.cast.string&&null!==e.cast.string||(e.cast.string=function(e){return e}),void 0===e.record_delimiter||null===e.record_delimiter)e.record_delimiter="\n";else if(r.isBuffer(e.record_delimiter))e.record_delimiter=e.record_delimiter.toString();else if("string"!==typeof e.record_delimiter)return Error("Invalid Option: record_delimiter must be a buffer or a string, got ".concat(JSON.stringify(e.record_delimiter)))}},{key:"_transform",value:function(e,r,t){if(!0!==this.state.stop){if(!Array.isArray(e)&&"object"!==typeof e)return this.state.stop=!0,t(Error("Invalid Record: expect an array or an object, got ".concat(JSON.stringify(e))));if(0===this.info.records)if(Array.isArray(e)){if(!0===this.options.header&&!this.options.columns)return this.state.stop=!0,t(Error("Undiscoverable Columns: header option requires column option or object records"))}else void 0!==this.options.columns&&null!==this.options.columns||(this.options.columns=this.normalize_columns(Object.keys(e)));0===this.info.records&&this.headers();try{this.emit("record",e,this.info.records)}catch(i){return this.state.stop=!0,this.emit("error",i)}if(this.options.eof){if(void 0===(e=this.stringify(e)))return;e+=this.options.record_delimiter}else{if(void 0===(e=this.stringify(e)))return;(this.options.header||this.info.records)&&(e=this.options.record_delimiter+e)}this.info.records++,this.push(e),t()}}},{key:"_flush",value:function(e){0===this.info.records&&this.headers(),e()}},{key:"stringify",value:function(e){var r=this,t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];if("object"!==typeof e)return e;var o=this.options,n=o.columns,c=(o.header,[]);if(Array.isArray(e)){n&&e.splice(n.length);for(var l=0;l<e.length;l++){var f=e[l],d=this.__cast(f,{index:l,column:l,records:this.info.records,header:t}),v=a(d,2),h=v[0],p=v[1];if(h)return void this.emit("error",h);c[l]=[p,f]}}else if(n)for(var m=0;m<n.length;m++){var y=k(e,n[m].key),g=this.__cast(y,{index:m,column:n[m].key,records:this.info.records,header:t}),_=a(g,2),O=_[0],q=_[1];if(O)return void this.emit("error",O);c[m]=[q,y]}else{var S,A=s(e);try{for(A.s();!(S=A.n()).done;){var j=S.value,w=e[j],E=this.__cast(w,{index:i,column:n[i].key,records:this.info.records,header:t}),I=a(E,2),N=I[0],x=I[1];if(N)return void this.emit("error",N);c.push([x,w])}}catch(B){A.e(B)}finally{A.f()}}for(var J="",T=function(e){var t=void 0,i=void 0,o=a(c[e],2),n=o[0],s=o[1];if("string"===typeof n)t=r.options;else if(b(n)){if(n=(t=n).value,delete t.value,"string"!==typeof n&&void 0!==n&&null!==n)return r.emit("error",Error("Invalid Casting Value: returned value must return a string, null or undefined, got ".concat(JSON.stringify(n)))),{v:void 0};if(t=u(u({},r.options),t),i=r.normalize(t))return r.emit("error",i),{v:void 0}}else{if(void 0!==n&&null!==n)return r.emit("error",Error("Invalid Casting Value: returned value must return a string, an object, null or undefined, got ".concat(JSON.stringify(n)))),{v:void 0};t=r.options}var l=t,f=l.delimiter,d=l.escape,v=l.quote,h=l.quoted,p=l.quoted_empty,m=l.quoted_string,y=l.quoted_match,g=l.record_delimiter;if(n){if("string"!==typeof n)return r.emit("error",Error("Formatter must return a string, null or undefined, got ".concat(JSON.stringify(n)))),{v:null};var _=f.length&&n.indexOf(f)>=0,O=""!==v&&n.indexOf(v)>=0,q=n.indexOf(d)>=0&&d!==v,S=n.indexOf(g)>=0,A=m&&"string"===typeof s,j=y&&y.filter((function(e){return"string"===typeof e?-1!==n.indexOf(e):e.test(n)}));j=j&&j.length>0;var w=!0===O||_||S||h||A||j;if(!0===w&&!0===q){var E="\\"===d?new RegExp(d+d,"g"):new RegExp(d,"g");n=n.replace(E,d+d)}if(!0===O){var I=new RegExp(v,"g");n=n.replace(I,d+v)}!0===w&&(n=v+n+v),J+=n}else(!0===p||""===s&&!0===m&&!1!==p)&&(J+=v+v);e!==c.length-1&&(J+=f)},C=0;C<c.length;C++){var V=T(C);if("object"===typeof V)return V.v}return J}},{key:"headers",value:function(){if(!1!==this.options.header&&void 0!==this.options.columns){var e=this.options.columns.map((function(e){return e.header}));e=this.options.eof?this.stringify(e,!0)+this.options.record_delimiter:this.stringify(e),this.push(e)}}},{key:"__cast",value:function(e,r){var t=typeof e;try{return"string"===t?[void 0,this.options.cast.string(e,r)]:"bigint"===t?[void 0,this.options.cast.bigint(e,r)]:"number"===t?[void 0,this.options.cast.number(e,r)]:"boolean"===t?[void 0,this.options.cast.boolean(e,r)]:e instanceof Date?[void 0,this.options.cast.date(e,r)]:"object"===t&&null!==e?[void 0,this.options.cast.object(e,r)]:[void 0,e,e]}catch(i){return[i]}}},{key:"normalize_columns",value:function(e){if(void 0!==e&&null!==e){if("object"!==typeof e)throw Error('Invalid option "columns": expect an array or an object');if(Array.isArray(e)){var r,t=[],i=s(e);try{for(i.s();!(r=i.n()).done;){var o=r.value;if("string"===typeof o)t.push({key:o,header:o});else{if("object"!==typeof o||void 0===o||Array.isArray(o))throw Error("Invalid column definition: expect a string or an object");if(!o.key)throw Error('Invalid column definition: property "key" is required');void 0===o.header&&(o.header=o.key),t.push(o)}}}catch(u){i.e(u)}finally{i.f()}e=t}else{var n=[];for(var a in e)n.push({key:a,header:e[a]});e=n}return e}}}]),o}(h),y=function(){var e,r,t;for(var i in arguments){var n=arguments[i],a=typeof n;if(void 0===e&&Array.isArray(n))e=n;else if(void 0===r&&b(n))r=n;else{if(void 0!==t||"function"!==a)throw new g("CSV_INVALID_ARGUMENT",["Invalid argument:","got ".concat(JSON.stringify(n)," at index ").concat(i)]);t=n}}var u=new m(r);if(t){var c=[];u.on("readable",(function(){for(var e;null!==(e=this.read());)c.push(e)})),u.on("error",(function(e){t(e)})),u.on("end",(function(){t(void 0,c.join(""))}))}if(void 0!==e)if("function"===typeof o)o((function(){var r,t=s(e);try{for(t.s();!(r=t.n()).done;){var i=r.value;u.write(i)}}catch(o){t.e(o)}finally{t.f()}u.end()}));else{var l,f=s(e);try{for(f.s();!(l=f.n()).done;){var d=l.value;u.write(d)}}catch(v){f.e(v)}finally{f.f()}u.end()}return u},g=function(e){"use strict";d(i,e);var t=v(i);function i(e,o){var n;c(this,i),Array.isArray(o)&&(o=o.join(" ")),n=t.call(this,o),void 0!==Error.captureStackTrace&&Error.captureStackTrace(f(n),i),n.code=e;for(var a=arguments.length,s=new Array(a>2?a-2:0),u=2;u<a;u++)s[u-2]=arguments[u];for(var l=0,d=s;l<d.length;l++){var v=d[l];for(var h in v){var p=v[h];n[h]=r.isBuffer(p)?p.toString():null==p?p:JSON.parse(JSON.stringify(p))}}return n}return i}(n(Error));y.Stringifier=m,y.CsvError=g,e.exports=y;var b=function(e){return"object"===typeof e&&null!==e&&!Array.isArray(e)},_=function(e){return e.replace(/([A-Z])/g,(function(e,r){return"_"+r.toLowerCase()}))},O=".".charCodeAt(0),q=/\\(\\)?/g,S=RegExp("[^.[\\]]+|\\[(?:([^\"'][^[]*)|([\"'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2)\\]|(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))","g"),A=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,j=/^\w*$/,w=function(e){var r=typeof e;return"symbol"===r||"object"===r&&e&&"[object Symbol]"===function(e){return Object.prototype.toString.call(e)}(e)},E=function(e,r){return Array.isArray(e)?e:function(e,r){if(Array.isArray(e))return!1;var t=typeof e;return!("number"!==t&&"symbol"!==t&&"boolean"!==t&&e&&!w(e))||(j.test(e)||!A.test(e)||null!=r&&e in Object(r))}(e,r)?[e]:function(e){var r=[];return e.charCodeAt(0)===O&&r.push(""),e.replace(S,(function(e,t,i,o){var n=e;i?n=o.replace(q,"$1"):t&&(n=t.trim()),r.push(n)})),r}(e)},I=function(e){if("string"===typeof e||w(e))return e;var r="".concat(e);return"0"==r&&1/e==-INFINITY?"-0":r},k=function(e,r){for(var t=0,i=(r=E(r,e)).length;null!=e&&t<i;)e=e[I(r[t++])];return t&&t===i?e:void 0}}).call(this,t(250).Buffer,t(375).setImmediate)}}]);
//# sourceMappingURL=18.fb7f9b75.chunk.js.map