///这个正则表达式的含义是：以 class 开头，后面可以跟任意数量的空格(\s+),0~任意空格(\s*/），
///然后是一个以字母开头的单词（[a-zA-Z]\w*）表示类名，
///然后是 extends 和一个单词（\w+），表示类的继承关系
///匹配泛型 (<[\w\s<>,]*>)?
///这个正则表达式会匹配整个 class 声明语句，而类名会匹配为第一个捕获组。
export const findSubClassRegex = /class\s+([a-zA-Z]\w*)(<[\w\s<>,]*>)?\s+extends\s+\w*/;
export const findClassRegex = /class\s+([a-zA-Z]\w*)(<[\w\s<>,]*>)?\s*/;
export const findSuperClassRegex = /extends\s+([a-zA-Z]\w*)/;
export const findDartImportRegex = /^import\s+['"][^'"]+['"];/gm
export const findPartLine = /part\s+([a-zA-Z]\w*).dart/;
export const findPartOfLine = /part of\s+([a-zA-Z]\w*).dart/;
export const findFreezedClassRegex = /with _\$/;
/// 檢查是否符合常用命名規範
export const nameCheckerRegex = /^(?:[a-z]+(?:[A-Z][a-z]*)*|^[A-Z][a-z]*([A-Z][a-z]*)*$|^[a-z]+(_[a-z]+)*$)$/;
export const findEmailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

export const biggerOpenRegex = /{/g;
export const biggerCloseRegex = /}/g;

export const smallOpenRegex = /\(/g
export const smallCloseRegex = /\)/g

/// 'd:\work\git\vscode_extension_lazy_jack\test\test1.dart match => ['test1', index: 44, input: 'd:\work\git\vscode_extension_lazy_jack\test\test1.dart', groups: undefined]
/// fileName =match[0].dart
export const findFileName = /[^\\\/]+(?=\.\w+$)/;

import * as changeCase from "change-case";
import { assert } from "console";



export function toUpperCamelCase(str: string): string {
  return changeCase.pascalCase(str).replace(/\s+/g, "")

}


export function toLowerCamelCase(str: string): string {
  return changeCase.camelCase(str)
 
}

export function toSnakeCase(str: string): string {
  return changeCase.snakeCase(toUpperCamelCase(str))
}

/// 這個函數的作用是判斷一個單詞是否是複數形式
export function isPlural(word: string): boolean {
  return /s$/.test(word);
}
export function isLowerCamelCase(str: string): boolean {
  return /^[a-z]+(?:[A-Z][a-z]*)*$/.test(str);
}

export function testLowerCamelGroup() {
  assert(testLowCamel("test1") === true)
  assert(testLowCamel("this_is_not_camel_case") === false)
  assert(testLowCamel("thisIsCamelCase") === true)
  assert(testLowCamel("thisIsCamelCase1") === true)
  assert(testLowCamel("ThisIsNotCamelCase") === false)
  assert(testLowCamel("this-is-not-camel-case") === false)
  assert(testLowCamel("this_is_not_camel_case") === false)
  assert(testLowCamel("this is not camel case") === false)
  assert(testLowCamel("123CamelCase") === false)


}


function testLowCamel(string: string): boolean {
  console.log(`${string} =>${isLowerCamelCase(string)} `)
  return isLowerCamelCase(string)
}

