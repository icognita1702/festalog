'use client'

import { useEffect, useRef } from 'react'
import twemoji from 'twemoji'

interface EmojiTextProps {
    text: string
    className?: string
}

export function EmojiText({ text, className = '' }: EmojiTextProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = text.replace(/\n/g, '<br/>')
            twemoji.parse(ref.current, {
                folder: 'svg',
                ext: '.svg',
                className: 'emoji-img',
            })
        }
    }, [text])

    return <div ref={ref} className={className} />
}
