/**
 * General Helpers
 *
 * This module contains general utility functions used across the application.
 *
 * Use Cases:
 * - Selecting random items from arrays for prompt generation.
 */
import { logFunctionCall } from './logger';

/**
 * Returns a random item from the provided array.
 * @param arr The array to select from.
 * @returns A random element from the array.
 */
export const getRandomItem = <T>(arr: T[]): T => {
  logFunctionCall('getRandomItem', { arrayLength: arr.length });
  return arr[Math.floor(Math.random() * arr.length)];
};
