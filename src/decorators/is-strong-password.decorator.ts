import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value || typeof value !== 'string') {
            return false;
          }

          // Minimum 12 characters
          if (value.length < 12) {
            return false;
          }

          // Must contain at least one uppercase letter
          if (!/[A-Z]/.test(value)) {
            return false;
          }

          // Must contain at least one lowercase letter
          if (!/[a-z]/.test(value)) {
            return false;
          }

          // Must contain at least one number
          if (!/[0-9]/.test(value)) {
            return false;
          }

          // Must contain at least one special character
          if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character';
        },
      },
    });
  };
}
