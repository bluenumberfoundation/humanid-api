'use strict'

const
	logger = require('../logger').child({ scope: 'Core.Components.Common' }),
	fs = require('fs'),
	path = require('path'),
	crypto = require('crypto'),
	jwt = require('jsonwebtoken'),
	request = require('request'),
	configPath = 'config.json'

// load config
let config = {DATABASE: {}}
if (fs.existsSync(path.join('.', configPath))) {
	config = require('../' + configPath)
} else {
	logger.warn(`${configPath} not found`)
}

// override config
config.CONFIRMATION_EXPIRY_MS = process.env.CONFIRMATION_EXPIRY_MS || config.CONFIRMATION_EXPIRY_MS || 30000
config.OTP_EXPIRY_MS = process.env.OTP_EXPIRY_MS || config.OTP_EXPIRY_MS || 60000
config.APP_SECRET = process.env.APP_SECRET || config.APP_SECRET || 'ThisIsADefaultSecretPhrase'
config.AUTHY_API_URL = process.env.AUTHY_API_URL || 'https://api.authy.com'
config.NEXMO_API_URL = process.env.NEXMO_API_URL || 'https://api.nexmo.com'
config.NEXMO_REST_URL = process.env.NEXMO_REST_URL || 'https://rest.nexmo.com'
config.AUTHY_API_KEY = process.env.AUTHY_API_KEY || config.AUTHY_API_KEY
config.NEXMO_API_KEY = process.env.NEXMO_API_KEY || config.NEXMO_API_KEY
config.NEXMO_API_SECRET = process.env.NEXMO_API_SECRET || config.NEXMO_API_SECRET
config.FIREBASE_SERVER_KEY = process.env.FIREBASE_SERVER_KEY || config.FIREBASE_SERVER_KEY
config.NEXMO_FROM = process.env.NEXMO_FROM || config.NEXMO_FROM || 'humanID'
config.APP_PORT = process.env.APP_PORT || config.APP_PORT || 3000
config.EXCHANGE_TOKEN_AES_KEY = process.env.EXCHANGE_TOKEN_AES_KEY || config.EXCHANGE_TOKEN_AES_KEY
config.EXCHANGE_TOKEN_AES_IV = process.env.EXCHANGE_TOKEN_AES_IV || config.EXCHANGE_TOKEN_AES_IV
config.EXCHANGE_TOKEN_LIFETIME = process.env.EXCHANGE_TOKEN_LIFETIME || config.EXCHANGE_TOKEN_LIFETIME
config.APP_DEBUG = process.env.APP_DEBUG || false
config.BASE_PATH = process.env.BASE_PATH || config.BASE_PATH || ''

// Demo App Config
config.DEMO_APP_JWT_LIFETIME = process.env.DEMO_APP_JWT_LIFETIME || '15m';

const SECRET = config.APP_SECRET

// hash data using secret
const hmac = (data, secret) => {
	secret = secret || SECRET
	return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

// sleep
const sleep = require('util').promisify(setTimeout)

// validate body
const validate = (rules, body) => {
	for (let r in rules) {
		// If field is a custom or inherited property, continue
		if (!rules.hasOwnProperty(r)) {
			continue
		}
		// Validate
		if (rules[r] === 'required' && !body[r]) {
			return {error: `${r} is required`}
		}
	}
	return null
}

// create (sign) JWT
const createJWT = (user) => {
	return jwt.sign({id: user.id}, SECRET)
}

// verify JWT
const verifyJWT = (token) => {
	return new Promise((resolve, reject) => {
		jwt.verify(token, SECRET, (err, decodedToken) => {
			if (err || !decodedToken) {
				return reject(err)
			}
			resolve(decodedToken)
		})
	})
}

// generate random string
const randStr = (length, type) => {
	let result = ''	
	let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	if (type === 1) {
		characters = '0123456789'
	} else if (type === 2) {
		characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
	}
	let charactersLength = characters.length
	for (let i = 0; i < length; i++ ) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength))
	}
	return result
}

// combine country code and phone number
const combinePhone = (countryCode, phone) => {
	phone = phone[0] === '0' ? phone.substring(1) : phone
	return countryCode + phone
}

// send push notif
const pushNotif = async (data, serverKey) => {
	let options = {
		method: 'post',
		url: 'https://fcm.googleapis.com/fcm/send',
		headers: {'Authorization': `key=${serverKey}`},
		json: true,
		body: data,
	}
	return new Promise((resolve, reject) => {
		request(options, (error, res, body) => {
			if (error) {
				reject(error)
			} else {
				resolve(body.results[0].message_id)
			}
		})  
	})
}

const getEpoch = t => {
	return Math.round(t.getTime() / 1000)
}

module.exports = {
	config: config,
	sleep: sleep,
	hmac: hmac,
	validate: validate,
	createJWT: createJWT,
	verifyJWT: verifyJWT,
	randStr: randStr,
	combinePhone: combinePhone,
	pushNotif: pushNotif,
	getEpoch
}
