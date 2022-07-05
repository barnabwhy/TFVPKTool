export function stripPakLang(directoryPath: string): string {
    let stripped: string = directoryPath.replace(/english|french|german|italian|japanese|korean|polish|portugese|russian|spanish|tchinese/, '');
    return stripped;
}

export function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
    let l = array.length;
    while (l--) {
        if (predicate(array[l], l, array))
            return l;
    }
    return -1;
}