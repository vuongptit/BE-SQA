

export const genCode = (lengthCode) => {
    let result = '';
    const chracteList = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for(let i = 0; i < lengthCode; i++){
        result += chracteList.charAt(Math.floor(Math.random()*chracteList.length))
    }

    return result
}

