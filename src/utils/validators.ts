export function isEmailValid(email: string){
     return /^\S+@\S+\.\S+$/.test(email.trim()); 
}

export function minLen(value:string, length: number){
    return value.trim().length >= length;
}