// lib/db.js
import { File, Directory, Paths } from 'expo-file-system'
import { Asset } from 'expo-asset'

let db = null

async function ensureDb() {
	
	if (db) return db
	const name='holybibles.db'
	const dir=new Directory(Paths.document,'SQLite')
	try {
		await dir.create()
	} catch (error) {
		// console.log(error)
	}
	
	const dest=new File(dir,name)
	if (!dest.exists) {
		const asset=Asset.fromModule(require('../assets/holybible.db'))
		await asset.downloadAsync()
		if (!asset.localUri) throw new Error('No localUri for DB asset')
		const src=new File(asset.localUri)
		await src.copy(dest)
	}
	db=SQLite.openDatabase(name)
	return db
}

export async function getDb(){return ensureDb()}

//lib/queries.js
import { getDb } from './db'

export async function getBooksCount(){
	const db = await getDb()
	const rows = await db.getAllAsync('SELECT MAX(Book)+1 as c FROM bible')
	return rows[0]?.c || 66
}
export async function getVerses(book,chapter){
	const db = await getDb()
	const rows = await db.getAllAsync('SELECT Book,Chapter,Versecount,verse FROM bible WHERE Book=? AND Chapter=? ORDER BY Versecount',[book,chapter])
	return rows
}

export async function searchVerses(q){
	const db = await getDb()
	const rows = await db.getAllAsync('SELECT Book,Chapter,Versecount,verse FROM bible WHERE verse LIKE ? LIMIT 200',[`%${q}%`])
	return rows
}

//lib/books.js
export const BOOKS = {
	1: 'Genesis',
	2: 'Exodus',
	3: 'Leviticus',
	4: 'Numbers',
	5: 'Deuteronomy',
	6: 'Joshua',
	7: 'Judges',
	8: 'Ruth',
	9: '1 Samuel',
	10: '2 Samuel',
	11: '1 Kings',
	12: '2 Kings',
	13: '1 Chronicles',
	14: '2 Chronicles',
	15: 'Ezra',
	16: 'Nehemiah',
	17: 'Esther',
	18: 'Job',
	19: 'Psalms',
	20: 'Proverbs',
	21: 'Ecclesiastes',
	22: 'Song of Solomon',
	23: 'Isaiah',
	24: 'Jeremiah',
	25: 'Lamentations',
	26: 'Ezekiel',
	27: 'Daniel',
	28: ' Hosea',
	29: 'Joel',
	30: 'Amos',
	31: 'Obadiah',
	32: 'Jonah',
	33: 'Micah',
	34: 'Nahum',
	35: 'Habakkuk',
	36: 'Zephaniah',
	37: 'Haggai',
	38: 'Zechariah',
	39: 'Malachi',
	40: 'Matthew',
	41: 'Mark',
	42: 'Luke',
	43: 'John',
	44: 'Acts',
	45: 'Romans',
	46: '1 Corinthians',
	47: '2 Corinthians',
	48: 'Galatians',
	49: 'Ephesians',
	50: 'Philippians',
	51: 'Colossians',
	52: '1 Thessalonians',
	53: '2 Thessalonians',
	54: '1 Timothy',
	55: '2 Timothy',
	56: 'Titus',
	57: 'Philemon',
	58: 'Hebrews',
	59: 'James',
	60: '1 Peter',
	61: '2 Peter',
	62: '1 John',
	63: '2 John',
	64: '3 John',
	65: 'Jude',
	66: 'Revelation'
}

//screens/Chapters.jsx

import { getBookMaxChapter } from '../lib/queries'
import { BOOKS } from '../lib/books'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

export default function ChaptersScreen({navigation,route}){
	const b = route.params.book
	const [max, setMax]=useState(0)
	useEffect(()=>{
		console.log(b)
		(async()=>{
			const m = await getBookMaxChapter(b)
			console.log(m)
			setMax(m)
		})()
	},[b])
	
	return (
		<View style={{flex:1}}>
			<View style={{padding:12}}>
				<Text style={{fontSize:18,fontWeight:'600'}}>{BOOKS[b]}</Text>
			</View>
			<FlatList data={Array.from({length:max},(_,i)=>i+1)} keyExtractor={(i)=>String(i)} numColumns={4} contentContainerStyle={{paddingHorizontal:8}} renderItem={({item})=>{
				return <Pressable onPress={()=>navigation.navigate('Verses',{book:b,chapter:item})} style={{margin:8,backgroundColor:'#f5f5f5',paddingVertical:14,paddingHorizontal:18,borderRadius:10}}>
					<Text style={{fontSize:16}}>{item}</Text>
				</Pressable>
			}}/>
		</View>
	)
}

its it not fetching chapters