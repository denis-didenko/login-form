'use strict';

class LoginForm extends Utils {
    constructor(formContainer, options = {}) {
        super();
        this.formContainer = formContainer;

        this.props = this.initProps(options);
        this.state = this.initState(this.formContainer);

        this.errorList = [];
        this.lastErrorContainer = null;
        this.isSubmitted = false;
        this.setEvents();
    }

    initProps(options) {
        const defaults = {
            login: {
                formNamespace: 'LoginForm',
                actionURL: '/site/checkLogin',
                formElement: '.login-form',
                emailElement: '.login-email-field',
                emailError: '[data-error-name="email"]',
                passwordElement: '.login-password-field',
                passwordError: '[data-error-name="password"]',
                submitElement: '.login-form-submit',
            },
            recovery: {
                formNamespace: 'RecoveryForm',
                actionURL: '/account/remindPassword',
                formElement: '.recovery-form',
                emailElement: '.recovery-email-field',
                emailError: '[data-error-name="email"]',
                emailSuccess: '[data-success-name="email"]',
                submitElement: '.recovery-form-submit',
            },
            fieldContainer: '.form-item',
            fieldElement: '.form-input input',
            errorClass: 'error-field',
            validClass: 'valid-field',
        };

        return this.mergeDeep(defaults, options); // class Utils (register)
    }

    initState(formContainer) {
        const loginForm = formContainer.querySelector(this.props.login.formElement);
        const recoveryForm = formContainer.querySelector(this.props.recovery.formElement);
        const fields = this.initFields(loginForm, recoveryForm);
        console.log('fields: ', fields);

        return {
            loginForm,
            recoveryForm,
            fields,
        };
    }

    initFields(loginForm, recoveryForm) {
        const { login, recovery } = this.props;

        const loginEmailField = loginForm.querySelector(login.emailElement);
        const loginEmailError = loginForm.querySelector(login.emailError);
        const loginPasswordField = loginForm.querySelector(login.passwordElement);
        const loginPasswordError = loginForm.querySelector(login.passwordError);

        const recoveryEmailField = recoveryForm.querySelector(recovery.emailElement);
        const recoveryEmailError = recoveryForm.querySelector(recovery.emailError);
        const recoveryEmailSuccess = recoveryForm.querySelector(recovery.emailSuccess);

        return {
            [loginEmailField.name]: {
                element: loginEmailField,
                value: null,
                error: loginEmailError,
            },

            [loginPasswordField.name]: {
                element: loginPasswordField,
                value: null,
                error: loginPasswordError,
            },

            [recoveryEmailField.name]: {
                element: recoveryEmailField,
                value: null,
                error: recoveryEmailError,
                success: recoveryEmailSuccess,
            },
        };
    }

    setEvents() {
        const { login, recovery } = this.props;
        const { loginForm, recoveryForm } = this.state;

        // Login form submit
        const loginSubmitBtn = loginForm.querySelector(login.submitElement);
        loginSubmitBtn.addEventListener('click', e => {
            e.preventDefault();
            if (this.hasSameValues(loginForm)) return; // cancel request for the same value

            this.submit(login.actionURL, loginForm);
        });

        // Recovery form submit
        const recoverySubmitBtn = recoveryForm.querySelector(recovery.submitElement);
        recoverySubmitBtn.addEventListener('click', e => {
            e.preventDefault();
            if (this.hasSameValues(recoveryForm)) return; // cancel request for the same value

            this.validate(recovery.actionURL, recoveryForm);
        });

        // Switch forms
        const forgotPassword = this.formContainer.querySelector('.recovery-password-btn');
        forgotPassword.addEventListener('click', e => {
            this.switchToForm('login', 'recovery');
        });

        const backToLogin = this.formContainer.querySelector('.login-switch-btn');
        backToLogin.addEventListener('click', e => {
            this.switchToForm('recovery', 'login');
        });
    }

    hasSameValues(form) {
        const sameValues = [];

        form.querySelectorAll(this.props.fieldElement).forEach(({ name, value }) => {
            sameValues.push(this.state.fields[name].value === value);
        });

        return sameValues.every(Boolean);
    }

    switchToForm(from, to) {
        const fromForm = this.formContainer.querySelector(this.props[from].formElement);
        const toForm = this.formContainer.querySelector(this.props[to].formElement);

        fromForm.classList.remove('visible');
        fromForm.classList.add('hidden');
        toForm.classList.remove('hidden');
        toForm.classList.add('visible');

        const { fields } = this.state;
        fields[`${this.props[to].formNamespace}[email]`].element.value =
            fields[`${this.props[from].formNamespace}[email]`].element.value;
        toForm.querySelector(this.props[to].submitElement).dispatchEvent(new Event('click'));
    }

    updateState(form) {
        form.querySelectorAll(this.props.fieldElement).forEach(({ name, value }) => {
            this.state.fields[name].value = value;
        });
    }

    redirect(url) {
        const exp = new RegExp(/\/\/(www|m)/);

        if (!exp.test(url)) {
            url = location.protocol + '//' + location.host + (url[0] === '/' ? url : '/' + url);
        }

        window.location.href = url;
    }

    prepareFetchOptions(form) {
        const body = new FormData(form);
        const headers = new Headers({ 'x-requested-with': 'XMLHttpRequest' });

        return {
            method: 'POST',
            headers,
            body,
        };
    }

    validate(url, form) {
        this.updateState(form);
        const options = this.prepareFetchOptions(form);

        return fetch(url, options)
            .then(res => res.json())
            .then(({ data, status, meta }) => {
                if (status === 'error') {
                    // cancel login spam
                    if (meta.code === 302 && meta.redirect) {
                        this.redirect(meta.redirect);
                        return;
                    }

                    this.renderErrors(meta.description);
                }

                if (status === 'success') {
                    // success recovery email
                    if (data.valid) {
                        this.renderErrors(data);
                        return;
                    }

                    this.errorList = [];
                }

                return this.errorList;
            })
            .catch(err => {
                console.error(err);
            });
    }

    renderErrors(data) {
        const { login, recovery } = this.props;
        const { fields } = this.state;

        // login response error
        if (data.type) {
            const errorName = `${login.formNamespace}[${data.type}]`;

            this.renderMessage(fields[errorName].error, data.message);
            this.errorList.push(errorName);
        }

        // recovery response error
        const recoveryName = `${recovery.formNamespace}[email]`;
        if (data.email) this.renderMessage(fields[recoveryName].error, data.email[0]);

        // recovery response success
        if (data.valid) this.renderMessage(fields[recoveryName].success, data.message);
    }

    renderMessage(container, message) {
        this.lastErrorContainer && (this.lastErrorContainer.innerHTML = ''); // delete last error message
        this.lastErrorContainer = container; // update last error container

        container.innerHTML = message; // render new error message
    }

    async submit(url, form) {
        // Prevent double submit form
        if (!this.isSubmitted) {
            const errors = await this.validate(url, form);

            if (!errors.length && !this.isSubmitted) {
                this.isSubmitted = true;
                form.submit();
            }
        }
    }
}

const loginFormContainer = document.querySelector('.login-form-wrapper');
const loginFormObj = new LoginForm(loginFormContainer, {
    login: { formElement: '.login-form' },
});
