import type {
  MessagePart,
  MessageLiteralPart,
  MessageMarkupPart,
} from 'messageformat'
import React from 'react'
import type { ReactElement } from 'react'

export function isMF2ComplexMessage(message: string) : boolean {
  // We can tell it's an MF2 complex message because either:
  // it begins with a .match, .local, or .input
  // or it begins with {{
  // Note: there is an ambiguity because the message {{foo}} might
  // either be an MF2 complex message, or a message with a single
  // interpolated variable in next-translate's native format.
  // We assume this is *not* an MF2 message, but it might not always be correct.
  return (message.startsWith(".match") || message.startsWith(".local")
   || message.startsWith(".input"));
}

// Converts markup placeholders to MF2
// Note: Numeric markup tags are prefixed with an underscore
// because in MF2, a markup tag name can't begin with a digit.
// This is fixed up in HetListToDOMTree().
export function convertToMf2(message: string): string {
  return message
    .replace(/<(\d+\/?)>/g, '{#_$1}')
    .replace(/<\/(\d+)>/g, '{/_$1}')
    .replace(/<(\w+\/?)>/g, '{#$1}') // open/standalone
    .replace(/<(\/\w+)>/g, '{$1}') // close
}

// Helper for HetListToDOMTree() that removes the underscores
// that were added to numeric tag names
function handleMarkupName(name: string): string {
  if (name.charAt(0) === '_') return name.substring(1)
  return name
}

// Represents a tree constructed from the sequence of
// formatted parts for a message
// A tree is either a MessagePart (leaf) or a Markup (node).
type PartsTree = Array<MessagePart | Markup>

// A Markup node represents tags with name `name`,
// enclosing another `PartsTree`.
class Markup {
  #markup: boolean
  name: string
  child: PartsTree

  constructor(name: string, child: PartsTree) {
    this.#markup = true
    this.name = name
    this.child = child
  }

  static isMarkup(obj: object): boolean {
    return #markup in obj
  }
}

// Takes a list of MessageParts that was produced by
// MessageFormat's formatToParts(), and returns a tree
export function MessagePartsToTree(parts: MessagePart[]): PartsTree {
  // Make a copy of `parts` so we can modify it
  const toDo = [...parts]

  // ProcessNodes() processes a flat list of message parts
  // into a tree structure.
  // `accum` is the list of already-processed subtrees.
  // The individual elements in the list are all `MessageParts`,
  // but the lists in the returned value may be nested arbitrarily.
  function ProcessNodes(accum: PartsTree): PartsTree {
    if (toDo.length === 0) {
      return accum
    }
    // Markup node: should be an `open` node if the output of formatToParts()
    // is valid.
    if (toDo[0].type === 'markup') {
      const markupNode = toDo[0] as MessageMarkupPart
      if (markupNode.kind === 'open') {
        const openNode = toDo.shift() as MessageMarkupPart
        // Recursively process everything between the open and close nodes
        const tree = ProcessNodes([])
        const closeNode = toDo.shift() as MessageMarkupPart
        if (closeNode.kind !== 'close') {
          console.log('Warning: unmatched tags!')
        }
        // Append a new subtree representing the tree denoted by this markup open/close pair
        const subtree = new Markup(openNode.name, tree)
        return ProcessNodes(accum.toSpliced(accum.length, 0, subtree))
      }
      // When we see a close tag, we just return the accumulator
      if (markupNode.kind === 'close') {
        return accum
      }
    }
    // Default case (not markup): append onto the existing list
    return ProcessNodes(accum.toSpliced(accum.length, 0, toDo.shift()!))
  }
  return ProcessNodes([])
}

// Maps markup onto components while transforming
// a PartsTree to a sequence of elements
export function TreeToElements(
  hetList: PartsTree,
  components: Record<string, ReactElement> | Array<ReactElement>
): ReactElement[] {
  return hetList.flatMap((part) => {
    // part is either a leaf (MessagePart) or node (Markup).
    // Handle the node case first.
    if (Markup.isMarkup(part)) {
      // `subtree` is all the nodes between the open and the close
      const markup = part as Markup
      const subtree = TreeToElements(markup.child, components)
      // Remove the leading underscore, if necessary
      const markupName = handleMarkupName(markup.name)
      // Use the name of the open node to look up the component in the map
      // (we assume open.name === close.name)
      // TODO: this means overlapping tags don't work
      const component: ReactElement = Array.isArray(components)
        ? components[Number(markupName)]
        : components[markupName]
      // Finally, wrap the sublist in a component of the kind
      // that matches its markup's name
      return component
        ? React.cloneElement(component, undefined, ...subtree)
        : subtree
    }
    if (Array.isArray(part)) {
      return TreeToElements(part, components)
    }
    // If part is not an array, it must be a MessagePart
    const messagePart = part as MessagePart
    switch (messagePart.type) {
      case 'literal':
        // Literals are just strings
        return <>{(messagePart as MessageLiteralPart).value}</>
      case 'markup':
        // assert part.kind=standalone
        return React.cloneElement(
          (components as Record<string, ReactElement>)[
            (messagePart as MessageMarkupPart).name
          ]
        )
      case 'number':
      case 'datetime': {
        return (
          <>{messagePart.parts?.reduce((acc, part) => acc + part.value, '')}</>
        )
      }
      case 'fallback': {
        return <>{`{${messagePart.source}}`}</>
      }
      default: {
        throw new Error(`unreachable: ${messagePart.type}`)
      }
    }
  })
}
