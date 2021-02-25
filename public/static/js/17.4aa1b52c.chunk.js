(this.webpackJsonpcmap_react=this.webpackJsonpcmap_react||[]).push([[17],{837:function(e,a,t){"use strict";var r=t(838);function n(e){this.message=e}n.prototype=new Error,n.prototype.name="InvalidTokenError",e.exports=function(e,a){if("string"!==typeof e)throw new n("Invalid token specified");var t=!0===(a=a||{}).header?0:1;try{return JSON.parse(r(e.split(".")[t]))}catch(s){throw new n("Invalid token specified: "+s.message)}},e.exports.InvalidTokenError=n},838:function(e,a,t){var r=t(839);e.exports=function(e){var a=e.replace(/-/g,"+").replace(/_/g,"/");switch(a.length%4){case 0:break;case 2:a+="==";break;case 3:a+="=";break;default:throw"Illegal base64url string!"}try{return function(e){return decodeURIComponent(r(e).replace(/(.)/g,(function(e,a){var t=a.charCodeAt(0).toString(16).toUpperCase();return t.length<2&&(t="0"+t),"%"+t})))}(a)}catch(t){return r(a)}}},839:function(e,a){function t(e){this.message=e}t.prototype=new Error,t.prototype.name="InvalidCharacterError",e.exports="undefined"!==typeof window&&window.atob&&window.atob.bind(window)||function(e){var a=String(e).replace(/=+$/,"");if(a.length%4==1)throw new t("'atob' failed: The string to be decoded is not correctly encoded.");for(var r,n,s=0,o=0,i="";n=a.charAt(o++);~n&&(r=s%4?64*r+n:n,s++%4)?i+=String.fromCharCode(255&r>>(-2*s&6)):0)n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(n);return i}},874:function(e,a,t){"use strict";t.r(a);var r=t(3),n=t(51),s=t(52),o=t(88),i=t(87),c=t(0),l=t.n(c),d=t(39),p=t(28),h=t(38),u=t(837),m=t.n(u),w=t(244),f=t(85),b=t(566),g=t(247),P=t(629),v=t(245),y=t(15),k=t(17),E=t(18),x={choosePasswordRequestSend:k.i,choosePasswordRequestReset:k.h},C=l.a.createRef(),S=function(e){Object(o.a)(t,e);var a=Object(i.a)(t);function t(e){var s;Object(n.a)(this,t),(s=a.call(this,e)).componentDidMount=function(){s.props.choosePasswordRequestReset()},s.handleChangePassword=function(e){s.setState(Object(r.a)(Object(r.a)({},s.state),{},{password:e.target.value}))},s.handleSubmit=function(){s.props.choosePasswordRequestSend({password:s.state.password,token:s.state.token})},s.handleChangeConfirmPassword=function(e){s.setState(Object(r.a)(Object(r.a)({},s.state),{},{confirmPassword:e.target.value}))},s.handleKeyPress=function(e){"Enter"===e.key&&C.current.click()};var o=e.location.pathname.split("/")[2],i=m()(o),c=new Date(0);c.setUTCSeconds(i.exp);var l=new Date>c;return s.state={password:"",confirmPassword:"",expired:l,token:o,email:i.sub},s}return Object(s.a)(t,[{key:"render",value:function(){var e=this.props,a=e.classes,t=e.choosePasswordState,r=this.state,n=r.password,s=r.confirmPassword,o=r.expired,i=/^(?=.*[0-9])(?=.*[.!@#$%^&*])[a-zA-Z0-9.!@#$%^&*]{8,32}$/.test(n),c=n===s,d=Boolean(0===n.length||!i||!c);return o?l.a.createElement(w.a,{className:a.paper},l.a.createElement(f.a,{className:a.description},"This link has expired. Click here to send a ",l.a.createElement(b.a,{component:h.b,to:{pathname:"/forgotpass"}},"new link"),".")):t===E.a.succeeded?l.a.createElement(w.a,{className:a.paper},l.a.createElement(f.a,{className:a.description},"Success! You can now log in using your new password.")):t===E.a.failed?l.a.createElement(w.a,{className:a.paper},l.a.createElement(f.a,{className:a.description},"We were unable to complete this request. Please try again.")):l.a.createElement(w.a,{className:a.paper},l.a.createElement(f.a,{className:a.description},"Please choose a password"),l.a.createElement(g.a,{direction:"column",justify:"space-evenly",className:a.formGrid,container:!0},l.a.createElement(g.a,{item:!0},l.a.createElement(P.a,{fullWidth:!0,autoFocus:!0,label:"Password",margin:"normal",id:"password",type:"password",variant:"outlined",name:"password",value:n,onChange:this.handleChangePassword,error:Boolean(!i&&n.length),helperText:"Must be 8 to 32 characters with 1 number and 1 special character.",onKeyPress:this.handleKeyPress,InputLabelProps:{shrink:!0}})),l.a.createElement(g.a,{item:!0},l.a.createElement(P.a,{fullWidth:!0,label:"Confirm Password",margin:"normal",id:"confirmPassword",type:"password",variant:"outlined",name:"confirmPassword",value:s,onChange:this.handleChangeConfirmPassword,error:!c,helperText:c?"":"Passwords must match",onKeyPress:this.handleKeyPress,InputLabelProps:{shrink:!0}})),l.a.createElement(g.a,{item:!0},l.a.createElement(v.a,{fullWidth:!0,variant:"outlined",color:"primary",disabled:d,onClick:this.handleSubmit,ref:C},"Submit"))))}}]),t}(c.Component);a.default=Object(d.b)((function(e,a){return{choosePasswordState:e.choosePasswordState}}),x)(Object(p.f)(Object(y.a)((function(e){return{paper:{width:"60%",margin:"120px auto",padding:"24px 12px"},textFields:{display:"block",width:"380px"},description:{marginBottom:"12px"},formGrid:{height:"270px",padding:"0 90px"},button:{width:"120px"}}}))(S)))}}]);
//# sourceMappingURL=17.4aa1b52c.chunk.js.map