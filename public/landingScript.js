function checkCookies(){
    let cookie = Cookies.get('UserInfo');
    
    if(cookie){
        let userInfo = JSON.parse(decodeURIComponent(Cookies.get('UserInfo')));
        let userEmail = userInfo.email;
        document.querySelector('#user-email').innerHTML = userEmail;
        document.querySelector('#navbar-login').style.display = 'none';
        document.querySelector('#navbar-register').style.display = 'none';
        document.querySelector('#navbar-user-dropdown').style.display = 'block';
    }

    else {
        document.querySelector('#navbar-login').style.display = 'block';
        document.querySelector('#navbar-register').style.display = 'block';
        document.querySelector('#navbar-user-dropdown').style.display = 'none';
    }
}

async function onGoogleSignin(user){
    let token = user.getAuthResponse(true).id_token;
    let response = await fetch(window.location.origin + '/api/user/googleauth', {
        credentials: 'include',
        method: 'POST',
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userIDToken: token}),
    })
    checkCookies();
    document.querySelector('#login-modal').style.display = 'none';
}

async function logOut(){
    await Cookies.remove('userInfo');
    await fetch('/api/user/signout', {credentials: 'include'});
    location.reload();
}

window.gapi.load('auth2', () => {
    window.gapi.auth2.init({client_id: '739716651449-7d1e8iijue6srr9l5mi2iogp982sqoa0.apps.googleusercontent.com'})
    .then((authInstance) => {
        authInstance.attachClickHandler(
            'google-login-button',
            null, //options
            onGoogleSignin,
            null // on error
        );
    })
});

async function submitContactForm(e){
    try {
        e.preventDefault();
        e.stopPropagation();
        let name = document.querySelector('#contact-us-name').value;
        let email = document.querySelector('#contact-us-email').value;
        let message = document.querySelector('#contact-us-message').value;
        
        await fetch('/api/community/contactus', {
            method: 'POST', 
            credentials: 'include',
            body: JSON.stringify({name, email, message}),
            headers: {
                'Content-Type': 'application/json'
              },
        });

        document.querySelector('#contact-us-success').style.display = 'block';
        document.querySelector('#contact-us-success').style.backgroundColor = '#93b968';
        document.querySelector('#contact-us-success').style.marginTop = '12px';
        document.querySelector('#contact-us-failure').style.display = 'none';
    }

    catch(e) {
        document.querySelector('#contact-us-failure').style.display = 'block';
        document.querySelector('#contact-us-failure').style.backgroundColor = 'red';
        document.querySelector('#contact-us-success').style.display = 'none';
    }
}

async function submitLoginForm(e){
    try {
        e.preventDefault();
        e.stopPropagation();
        let username = document.querySelector('#username').value;
        let password = document.querySelector('#password').value;
        
        let result = await fetch('/api/user/signin', {
            method: 'POST', 
            credentials: 'include',
            body: JSON.stringify({username, password}),
            headers: {
                'Content-Type': 'application/json'
              },
        });

        if(result.status === 401){
            document.querySelector('#login-failed').style.display = 'block';
        }
        
        else {
            checkCookies();
            document.querySelector('#login-failed').style.display = 'none';
            document.querySelector('#login-modal').style.display = 'none';
        }
    }

    catch(e) {
        console.log(e);
    }
}

document.querySelector('#logout-button').addEventListener("click", logOut);
document.querySelector('#email-form').addEventListener('submit', submitContactForm);
document.querySelector('#email-form-2').addEventListener('submit', submitLoginForm);

checkCookies();