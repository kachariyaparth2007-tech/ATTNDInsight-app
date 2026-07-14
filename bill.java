import java.util.Scanner;

class addition
{
	public static void main(String args[])
	{
		Scanner sc=new Scanner(System.in);
		int x,y,sum,sub,mul,div;
		
		System.out.print("Enter First Number: ");
		x=sc.nextInt();

		System.out.print("Enter Second Number: ");
		y=sc.nextInt();

		sum=x+y;
		sub=x-y;
		mul=x*y;
		div=x/y;

		System.out.println("sum= "+sum);
        System.out.println("sub= "+sub);
		System.out.println("mul= "+mul);
		System.out.println("div= "+div);	
	}
}
