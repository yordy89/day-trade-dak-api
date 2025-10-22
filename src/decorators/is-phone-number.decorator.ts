import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) {
            // Allow optional phone numbers
            return true;
          }

          if (typeof value !== 'string') {
            return false;
          }

          try {
            // Check if valid phone number
            if (!isValidPhoneNumber(value)) {
              return false;
            }

            // Parse and validate format
            const phoneNumber = parsePhoneNumber(value);
            return phoneNumber.isValid();
          } catch (error) {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid phone number in international format (e.g., +1234567890)`;
        },
      },
    });
  };
}
