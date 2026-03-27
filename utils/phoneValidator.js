const validatePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return { isValid: true, message: null, country: null }; // Optional phone

    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');

    // Country code patterns with full country names
    const countryPatterns = {
        '216': { code: 'Tunisie', pattern: /^216[0-9]{8}$/, digits: 8 },
        '213': { code: 'Algérie', pattern: /^213[0-9]{9}$/, digits: 9 },
        '212': { code: 'Maroc', pattern: /^212[0-9]{9}$/, digits: 9 },
        '218': { code: 'Libye', pattern: /^218[0-9]{9,10}$/, digits: '9-10' },
        '20': { code: 'Égypte', pattern: /^20[0-9]{10}$/, digits: 10 },
        '966': { code: 'Arabie Saoudite', pattern: /^966[0-9]{9}$/, digits: 9 },
        '971': { code: 'Émirats Arabes Unis', pattern: /^971[0-9]{9}$/, digits: 9 },
        '974': { code: 'Qatar', pattern: /^974[0-9]{8}$/, digits: 8 },
        '973': { code: 'Bahreïn', pattern: /^973[0-9]{8}$/, digits: 8 },
        '968': { code: 'Oman', pattern: /^968[0-9]{8}$/, digits: 8 },
        '965': { code: 'Koweït', pattern: /^965[0-9]{8}$/, digits: 8 },
        '961': { code: 'Liban', pattern: /^961[0-9]{8}$/, digits: 8 },
        '962': { code: 'Jordanie', pattern: /^962[0-9]{9}$/, digits: 9 },
        '963': { code: 'Syrie', pattern: /^963[0-9]{9}$/, digits: 9 },
        '964': { code: 'Irak', pattern: /^964[0-9]{10}$/, digits: 10 },
        '967': { code: 'Yémen', pattern: /^967[0-9]{9}$/, digits: 9 },
        '1': { code: 'USA/Canada', pattern: /^1[0-9]{10}$/, digits: 10 },
        '44': { code: 'UK', pattern: /^44[0-9]{10}$/, digits: 10 },
        '33': { code: 'France', pattern: /^33[0-9]{9}$/, digits: 9 }
    };

    // Detect country code
    let detectedCountry = null;
    for (const [prefix, country] of Object.entries(countryPatterns)) {
        if (digits.startsWith(prefix)) {
            detectedCountry = country;
            break;
        }
    }

    const isValid = detectedCountry ? detectedCountry.pattern.test(digits) : digits.length >= 8 && digits.length <= 15;

    return {
        isValid: Boolean(isValid),
        message: isValid ?
            'Valid phone number' :
            detectedCountry ?
                `Invalid format for ${detectedCountry.code}.` :
                'Invalid phone number format',
        country: detectedCountry?.code || 'Unknown'
    };
};

module.exports = validatePhoneNumber;
