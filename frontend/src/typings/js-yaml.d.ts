declare module "js-yaml" {
    export function dump(data: unknown, options?: { indent?: number; lineWidth?: number }): string;
}
