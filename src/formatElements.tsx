import { MessageFormat, MessageSyntaxError, type MessagePart } from 'messageformat'
import {
  convertToMf2,
  MessagePartsToTree,
  TreeToElements,
} from './messageFormatHelpers'
import type { ReactElement, ReactNode } from 'react'

export default function formatElements(
  value: string,
  elements: ReactElement[] | Record<string, ReactElement> = []
): string | ReactNode[] {
  // Convert message to MF2 syntax
  const message = convertToMf2(value)
  let list : MessagePart[] = []
  try {
      // Create an MF2 formatter
    const mf = new MessageFormat(message)
    // Format the MF2 message to a linear sequence of parts
    list = mf.formatToParts()
  } catch(e) {
    if (e instanceof MessageSyntaxError) {
      console.log("Warning: error when parsing message " + value + "\n" + JSON.stringify(e))
      return value
    }
    throw e
  }
  // Reconstruct the tree of markup tags from the sequence
  const processed = MessagePartsToTree(list)
  // Map markup onto components
  const contents = TreeToElements(processed, elements)
  return contents
}
