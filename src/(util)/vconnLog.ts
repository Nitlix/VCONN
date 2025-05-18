export default function ({
    error = false,
    message,
}: {
    error?: boolean;
    message: string;
}) {
    if (error) {
        return console.error(`[VCONN]`, message);
    }
    return console.log(`[VCONN]`, message);
}
