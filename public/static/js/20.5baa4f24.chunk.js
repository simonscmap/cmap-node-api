(this.webpackJsonpcmap_react=this.webpackJsonpcmap_react||[]).push([[20],{800:function(e,a,t){"use strict";var n=t(0),r=t.n(n),l=t(46);a.a=Object(l.a)(r.a.createElement("path",{d:"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"}),"Edit")},876:function(e,a,t){"use strict";t.r(a);var n=t(3),r=t(51),l=t(52),i=t(353),s=t(89),o=t(88),c=t(0),m=t.n(c),u=t(39),d=t(15),p=t(244),h=t(86),g=t(246),f=t(572),b=t(247),E=t(621),v=t(245),w=t(800),P=t(17),C=t(5),y=t(62),x=t(553),O=t(556),k=t(557),j=t(620),N=t(622),I=t(32),D={changePasswordRequestSend:P.f,hideChangePasswordDialog:C.c},S=Object(u.b)((function(e,a){return{user:e.user}}),D)(Object(d.a)((function(e){return{dialogPaper:{backgroundColor:I.a.solidPaper,"@media (max-width: 768px)":{margin:0}},formWrapper:{padding:"3vh 5vw"}}}))((function(e){var a=e.classes,t=m.a.useState(""),n=Object(y.a)(t,2),r=n[0],l=n[1],i=m.a.useState(""),s=Object(y.a)(i,2),o=s[0],c=s[1],u=m.a.useState(""),d=Object(y.a)(u,2),p=d[0],h=d[1],g=Boolean(/^(?=.*[0-9])(?=.*[.!@#$%^&*])[a-zA-Z0-9.!@#$%^&*]{8,32}$/.test(o)||!o),f=Boolean(!p||p===o),w=function(){l(""),c(""),h("")},P=function(){e.hideChangePasswordDialog(),w()},C=m.a.useRef(),I=function(e){"Enter"===e.key&&C.current.click()},D=Boolean(!o||!p||!g||!f);return m.a.createElement(x.a,{open:e.open,onClose:P,"aria-labelledby":"form-dialog-title",PaperProps:{className:a.dialogPaper},onEnter:w},m.a.createElement(O.a,{id:"form-dialog-title"},"Change Password"),m.a.createElement(k.a,null,m.a.createElement(j.a,null,"Please enter your current and new password."),m.a.createElement(b.a,{container:!0,className:a.formWrapper},m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{autoFocus:!0,margin:"normal",id:"currentPassword",label:"Current Password",type:"password",variant:"outlined",name:"currentPassword",value:r,onChange:function(e){return l(e.target.value)},InputLabelProps:{shrink:!0},fullWidth:!0,onKeyPress:I})),m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{margin:"normal",id:"newPassword",label:"New Password",type:"password",variant:"outlined",name:"newPassword",value:o,onChange:function(e){return c(e.target.value)},InputLabelProps:{shrink:!0},fullWidth:!0,error:!g,helperText:g?"":"Must be 8 to 32 characters with 1 number and 1 special character.",onKeyPress:I})),m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{margin:"normal",id:"newPasswordConfirm",label:"Confirm New Password",type:"password",variant:"outlined",name:"newPasswordConfirm",value:p,onChange:function(e){return h(e.target.value)},InputLabelProps:{shrink:!0},fullWidth:!0,error:!f,helperText:f?"":"Passwords must match.",onKeyPress:I}))),m.a.createElement(N.a,null,m.a.createElement(v.a,{onClick:function(){return P()},color:"primary"},"Cancel"),m.a.createElement(v.a,{color:"primary",variant:"contained",onClick:function(){e.changePasswordRequestSend(r,o,e.user.username)},disabled:D,ref:C},"Confirm"))))}))),R={changeEmailRequestSend:P.e,hideChangeEmailDialog:C.b},L=Object(u.b)((function(e,a){return{user:e.user}}),R)(Object(d.a)((function(e){return{dialogPaper:{backgroundColor:I.a.solidPaper,"@media (max-width: 768px)":{margin:0}},formWrapper:{padding:"3vh 5vw"}}}))((function(e){var a=e.classes,t=m.a.useState(""),n=Object(y.a)(t,2),r=n[0],l=n[1],i=m.a.useState(""),s=Object(y.a)(i,2),o=s[0],c=s[1],u=m.a.useState(""),d=Object(y.a)(u,2),p=d[0],h=d[1],g=function(){l(""),c(""),h("")},f=function(){g(),e.hideChangeEmailDialog()},w=m.a.useRef(),P=function(e){"Enter"===e.key&&w.current.click()},C=Boolean(function(e){return/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(e)}(o)||!o),I=Boolean(!p||o===p),D=Boolean(!o||!p||!C||!I);return m.a.createElement(x.a,{open:e.open,onClose:f,"aria-labelledby":"form-dialog-title",PaperProps:{className:a.dialogPaper},onEnter:g},m.a.createElement(O.a,{id:"form-dialog-title"},"Change Email"),m.a.createElement(k.a,null,m.a.createElement(j.a,null,"Please enter your account password, and new email address."),m.a.createElement(b.a,{container:!0,className:a.formWrapper},m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{autoFocus:!0,margin:"normal",id:"currentPassword",label:"Password",type:"password",variant:"outlined",name:"currentPassword",value:r,onChange:function(e){return l(e.target.value)},InputLabelProps:{shrink:!0},onKeyPress:P,fullWidth:!0})),m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{margin:"normal",id:"email",label:"New Email",type:"text",variant:"outlined",name:"email",value:o,onChange:function(e){return c(e.target.value)},InputLabelProps:{shrink:!0},fullWidth:!0,error:!C,helperText:C?"":"Please enter a valid email address"})),m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{margin:"normal",id:"emailConfirm",label:"Confirm Email",type:"text",variant:"outlined",name:"emailConfirm",value:p,onChange:function(e){return h(e.target.value)},InputLabelProps:{shrink:!0},fullWidth:!0,onKeyPress:P,error:!I,helperText:I?"":"Email addresses must match."}))),m.a.createElement(N.a,null,m.a.createElement(v.a,{onClick:f,color:"primary"},"Cancel"),m.a.createElement(v.a,{color:"primary",variant:"contained",onClick:function(){e.changeEmailRequestSend(o,r,e.user.username)},ref:w,disabled:D},"Confirm"))))}))),q={updateUserInfoRequestSend:P.A,showChangePasswordDialog:C.k,showChangeEmailDialog:C.j},B={firstName:{label:"First Name",name:"firstName",type:"text",requirement:"Must be 2 or more alphabetical characters."},lastName:{label:"Last Name",name:"lastName",type:"text",requirement:"Must be 2 or more alphabetical characters."},institute:{label:"Institute",name:"institute",type:"text",requirement:"Maximum length is 150 characters."},department:{label:"Department",name:"department",type:"text",requirement:"Maximum length is 150 characters."},country:{label:"Country",name:"country",type:"text",requirement:"Maximum length is 150 characters."}},F=function(e){return{editable:!1,firstName:{value:e.firstName,valid:!0},lastName:{value:e.lastName,valid:!0},institute:{value:e.institute||"",valid:!0},department:{value:e.department||"",valid:!0},country:{value:e.country||"",valid:!0},email:{value:e.email||"",valid:!0}}},T=function(e){Object(s.a)(t,e);var a=Object(o.a)(t);function t(e){var l;return Object(r.a)(this,t),(l=a.call(this,e)).handleChange=function(e){var a=e.target.value,t=e.target.name,r=l.handleValidation(t,a);l.setState(Object(n.a)(Object(n.a)({},l.state),{},{infoHasChanged:!0,[t]:{value:a,valid:r}}))},l.componentDidUpdate=function(e){e.user!==l.props.user&&l.setState(Object(n.a)(Object(n.a)({},l.state),F(l.props.user)))},l.handleValidation=function(e,a){var t=a.trim(),n=/$^/;switch(e){case"firstName":case"lastName":n=/^[A-Za-z ]{2,40}$/;break;case"email":n=/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/;break;case"institute":case"department":case"country":n=/^.{0,150}$/}return n.test(t)},l.handleEdit=function(){l.setState(Object(n.a)(Object(n.a)({},l.state),{},{editable:!0}))},l.handleCancel=function(){l.setState(Object(n.a)(Object(n.a)({},F(l.props.user)),{},{editable:!1,infoHasChanged:!1}))},l.handleConfirm=function(){l.props.updateUserInfoRequestSend({firstName:l.state.firstName.value.trim(),lastName:l.state.lastName.value.trim(),institute:l.state.institute.value.trim(),department:l.state.department.value.trim(),country:l.state.country.value.trim()})},e.user?(l.state=Object(n.a)(Object(n.a)({},F(e.user)),{},{editable:!1,infoHasChanged:!1}),l):Object(i.a)(l)}return Object(l.a)(t,[{key:"render",value:function(){var e=this;if(!this.props.user)return window.location.href="/login","";var a=this.props,t=a.classes,r=a.changeEmailDialogIsOpen,l=a.changePasswordDialogIsOpen,i=a.showChangePasswordDialog,s=a.showChangeEmailDialog,o=this.state,c=o.editable,u=o.infoHasChanged,d=!0;return Object.keys(B).forEach((function(a){e.state[a].valid||(d=!1)})),m.a.createElement(m.a.Fragment,null,m.a.createElement(S,{open:l,close:function(){return e.setState(Object(n.a)(Object(n.a)({},e.state),{},{changePasswordDialogOpen:!1}))}}),m.a.createElement(L,{open:r,close:function(){return e.setState(Object(n.a)(Object(n.a)({},e.state),{},{changeEmailDialogOpen:!1}))}}),m.a.createElement(p.a,{className:t.profilePaper,elevation:6},m.a.createElement(h.a,{variant:"h5",align:"left",className:t.header},"Profile"),m.a.createElement(g.a,{title:"Edit Information"},m.a.createElement(f.a,{className:t.editButton,color:"primary",onClick:this.handleEdit,disableFocusRipple:!0,disableRipple:!0},m.a.createElement(w.a,null))),m.a.createElement(b.a,{container:!0,spacing:1},Object.keys(B).map((function(a,n){return m.a.createElement(b.a,{key:n,item:!0,xs:12,md:6},m.a.createElement(E.a,{name:a,label:B[a].label,value:e.state[a].value,error:!e.state[a].valid,helperText:e.state[a].valid?"":B[a].requirement,key:n,onChange:e.handleChange,inputProps:{readOnly:!c},InputLabelProps:{shrink:!0},className:t.textField}))})),m.a.createElement(b.a,{item:!0,xs:6})),c&&m.a.createElement(b.a,{className:t.buttonGrid,container:!0},m.a.createElement(b.a,{item:!0,md:9,xs:!1}),m.a.createElement(b.a,{item:!0,md:1,xs:6},m.a.createElement(v.a,{onClick:this.handleCancel},"Cancel")),m.a.createElement(b.a,{item:!0,md:2,xs:6},m.a.createElement(v.a,{onClick:this.handleConfirm,variant:"contained",color:"primary",disabled:!u||!d},"Confirm")))),m.a.createElement(p.a,{className:t.accountPaper,elevation:6},m.a.createElement(h.a,{variant:"h5",align:"left",className:t.header},"Account"),m.a.createElement(b.a,{container:!0},m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{name:"email",label:"Email",value:this.state.email.value,inputProps:{readOnly:!0},InputLabelProps:{shrink:!0},className:t.textField}),m.a.createElement(g.a,{title:"Change Email"},m.a.createElement(f.a,{color:"primary",disableFocusRipple:!0,disableRipple:!0,onClick:function(){return s()}},m.a.createElement(w.a,null)))),m.a.createElement(b.a,{item:!0,xs:12},m.a.createElement(E.a,{name:"Password",label:"Password",value:"********",inputProps:{readOnly:!0},InputLabelProps:{shrink:!0},className:t.textField}),m.a.createElement(g.a,{title:"Change Password"},m.a.createElement(f.a,{color:"primary",disableFocusRipple:!0,disableRipple:!0,onClick:function(){return i()}},m.a.createElement(w.a,null)))))))}}]),t}(c.Component);a.default=Object(u.b)((function(e,a){return{user:e.user,changePasswordDialogIsOpen:e.changePasswordDialogIsOpen,changeEmailDialogIsOpen:e.changeEmailDialogIsOpen}}),q)(Object(d.a)((function(e){return{profilePaper:{"@media (min-width: 768px)":{width:"60vw"},width:"100vw",margin:"".concat(e.spacing(16),"px auto 0 auto"),paddingTop:e.spacing(2),paddingBottom:e.spacing(2)},accountPaper:{"@media (min-width: 768px)":{width:"60vw"},width:"100vw",margin:"".concat(e.spacing(6),"px auto 0 auto"),paddingTop:e.spacing(2),paddingBottom:e.spacing(2)},textField:{margin:e.spacing(1),width:"80%",maxWidth:"calc(100% - 52px)"},buttonGrid:{marginTop:e.spacing(1)},editButton:{float:"right",display:"inline-block",marginTop:"-16px"},header:{paddingLeft:e.spacing(3),display:"inline-block",marginTop:"-4px",float:"left"},accountEditButton:{float:"left",marginTop:"6px"}}}))(T))}}]);
//# sourceMappingURL=20.5baa4f24.chunk.js.map