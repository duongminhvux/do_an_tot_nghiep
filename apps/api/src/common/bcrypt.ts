import bcrypt from 'bcrypt';
const saltRounds = 10;

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(password, salt);
}

const comparePassword = async (rawPassword: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(rawPassword, hash);
}

export { hashPassword, comparePassword };